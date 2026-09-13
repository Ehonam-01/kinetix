# Sécurité

Document dû depuis la Phase 2 (« complété en continu » selon le plan initial), rédigé en Phase 10
en reprenant ce qui a réellement été construit — pas une checklist aspirationnelle.

## Modèle d'autorisation

- **Aucune confiance dans le client.** Next.js 16 : les Server Functions (`"use server"`) sont
  atteignables par POST direct, pas seulement depuis l'UI qui les appelle — donc chaque service
  vérifie lui-même l'authentification et le rôle, jamais seulement via une page qui le ferait en
  amont. `src/proxy.ts` (l'ancien `middleware.ts`) ne fait que rafraîchir la session Supabase, ce
  n'est pas une couche d'autorisation.
- **Deux gardes réutilisées partout** (`services/auth/current-user.ts`) : `requireUser()` (session
  valide, sinon redirection `/login`) et `requireAdmin()` (idem + `role === "ADMIN"`, sinon
  redirection `/dashboard`).
- **Défense en profondeur sur les actions admin** : chaque service admin (`grantAdminCredit`,
  `setMemberStatus`, `updateRewardDeliveryStatus`, `createCourse`/`createModule`/`createLesson`,
  `updateParameter`) revérifie `role === "ADMIN"` **à l'intérieur de sa propre transaction**, même
  si l'appelant (une page gardée par `requireAdmin()`) l'a déjà vérifié — jamais une seule couche
  de vérification pour une opération qui déplace de l'argent ou des droits.
- **Garde-fous métier supplémentaires**, pas seulement rôle/session : un admin ne peut pas se
  suspendre lui-même (`setMemberStatus`), un paiement par solde exige que le payeur soit le
  parrain enregistré du bénéficiaire (`wallet-payment.ts`), une récompense ne peut être réclamée
  que par son propriétaire et seulement si elle est encore `ELIGIBLE` (contrainte dans la clause
  `WHERE`, pas seulement en code applicatif).

## Row Level Security (RLS)

Activée sur toutes les tables — **défense en profondeur uniquement**. Le chemin d'accès réel de
l'application passe par Drizzle en connexion Postgres directe (`DATABASE_URL`), qui contourne RLS
par construction ; l'autorisation qui compte vraiment est celle décrite ci-dessus. Les policies
RLS protègent contre un scénario différent : une future requête faite directement avec la clé
publique Supabase (`anon`/`authenticated`) plutôt que via le serveur applicatif. Convention
constante depuis la Phase 2 : policies `SELECT` scopées à `auth.uid()` pour les données propres à
un membre, catalogue public (`SELECT USING (true)`) pour les tables de référence non sensibles
(`levels`, `rewards`, `courses`...), aucune policy `INSERT`/`UPDATE`/`DELETE` nulle part (l'écriture
ne passe jamais par ce chemin).

Aucune clé `service_role` Supabase n'est utilisée dans ce projet (pas d'appel à l'admin API Auth ou
Storage) — la connexion Postgres directe fait déjà autorité côté serveur, ajouter `service_role`
serait une deuxième voie d'accès privilégié sans bénéfice actuel.

## Idempotence (protection contre le double paiement)

Toute écriture financière porte une clé d'unicité vérifiée en base, pas seulement en mémoire :

- `commission_events.dedupe_key`, `payment_events.dedupe_key`, `payments.idempotency_key`,
  `member_rewards (user_id, reward_id)` — tous `UNIQUE`, tous posés via `ON CONFLICT DO NOTHING`.
- Le webhook Moneroo est vérifié par signature HMAC-SHA256 (`timingSafeEqual`, pas une comparaison
  de chaînes classique — évite une fuite de timing) avant même d'être parsé métier.
- Voir `MLM_RULES.md` (section Idempotence) et `FINANCIAL_MODEL.md` pour le détail des clés.

## OTP par email (transferts entre membres)

Deuxième facteur applicatif ajouté après la Phase 10, requis avant tout mouvement d'argent
membre-à-membre (`services/wallet/`, voir `ARCHITECTURE.md` pour le détail des deux services) :

- Code à 6 chiffres généré par `crypto.randomInt` (CSPRNG), jamais `Math.random()`.
- Stocké haché (SHA-256), jamais en clair — `services/wallet/otp.ts`. SHA-256 plutôt qu'un hash
  lent type bcrypt : la sécurité d'un OTP vient de son expiration courte et du plafond de
  tentatives, pas du coût du hash — bcrypt-er un code à 6 chiffres à chaque tentative de
  confirmation n'apporterait rien de plus, juste de la latence.
- Comparaison en temps constant (`crypto.timingSafeEqual`), même principe que la vérification de
  signature webhook Moneroo.
- Expiration à 10 minutes, plafond de 5 tentatives — au-delà, la demande passe à `EXPIRED` et un
  nouveau transfert (donc un nouveau code) est requis ; jamais un simple retour "code invalide"
  sans compteur qui persiste.
- Une nouvelle demande de transfert expire explicitement toute demande `PENDING_OTP` encore
  ouverte pour le même émetteur — un attaquant qui intercepterait un ancien code ne peut pas
  l'utiliser contre une demande plus récente portant sur un autre montant/destinataire.

## Secrets et configuration

- Toute variable d'environnement sensible est validée par Zod au démarrage (`config/env.ts`), sauf
  les clés Moneroo (`config/env.moneroo.ts`) et Resend (`config/env.email.ts`) dont la validation
  est **paresseuse** (`getMonerooEnv()`/`getEmailEnv()`, pas une constante au chargement du
  module) — pour que l'absence de ces clés n'empêche pas `next build` ni les routes qui n'en ont
  pas besoin (piège rencontré et documenté en Phase 5, voir `DATABASE.md`).
- `.env.local` n'est jamais commité (`.gitignore`), `.env.example` documente les variables
  attendues sans valeurs réelles.
- Mots de passe : gérés entièrement par Supabase Auth (hachage, réinitialisation par email) — ce
  projet ne stocke, ne compare ni ne dérive jamais de mot de passe lui-même.

## Ce qui n'est délibérément pas encore couvert

- **Limitation de débit (rate limiting)** sur les routes d'authentification ou de recherche —
  aucune en place. À ajouter avant une mise en production réelle, en particulier sur `/login` et
  la recherche de pseudo (`searchDownlineMembers`, `ILIKE` sur `profiles.username`).
- **CSRF** : Next.js protège nativement les Server Actions par une vérification d'origine
  (`Origin`/`Referer`) sur les requêtes de mutation — aucune protection supplémentaire ajoutée ici,
  aucune n'a semblé nécessaire au-delà de ce que le framework fournit déjà.
- **Audit de sécurité externe / pentest** : jamais fait. Le panneau admin et les flux financiers
  sont les surfaces à prioriser si un audit est commandé.
