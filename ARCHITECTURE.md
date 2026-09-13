# Architecture

## Couches applicatives

```
src/
  app/            Routes Next.js (App Router). Zéro logique métier — appelle des Server Actions.
  components/     UI réutilisable (shadcn/ui). Aucun accès réseau/DB direct.
  features/       UI + hooks + état local par domaine (auth, genealogy, commissions...).
  services/       Orchestration métier, transactions, émission d'événements. Seule couche
                  autorisée à écrire des données financières/MLM.
  repositories/   Requêtes Drizzle pures, un module par cluster de tables. Aucune règle métier.
  db/             Schéma Drizzle (db/schema/), migrations (db/migrations/), client (db/client.ts).
  schemas/        Validation Zod, partagée client/serveur.
  config/         Lecture des paramètres (env, paramètres versionnés en DB).
  lib/            Utilitaires transverses sans état (money, auth guards, supabase clients...).
  types/          DTOs partagés.
  hooks/          Hooks React client (lecture uniquement, jamais d'écriture financière).
```

Règle : la logique MLM et financière n'est **jamais** écrite dans un composant React ou directement
dans une Server Action. Une Server Action valide son input (Zod) puis appelle un service ; le service
orchestre la transaction et appelle les repositories.

`services/`, `repositories/`, `features/`, `schemas/` et `types/` se peuplent au fil des phases, à
mesure qu'une fonctionnalité a un vrai code appelant — pas de sous-dossiers vides créés à l'avance.
`services/auth/`, `repositories/profiles.ts` et `schemas/auth.ts` existent depuis la Phase 2
(inscription, connexion, vérification email, reset password — voir `src/app/(auth)/` et
`src/app/auth/callback/`). `services/genealogy/` et `repositories/binary-nodes.ts` existent depuis
la Phase 3 (parrainage, placement binaire — voir section suivante). L'attribution du parrain est
câblée dans `src/app/auth/callback/route.ts`, juste après la création du profil (section 7 du
prompt directeur : un membre non actif n'occupe pas de nœud, donc pas de placement à ce stade).
`services/mlm/` (`unlockLevel`, `createCommissionEvent`) existe depuis la Phase 4 — voir
`MLM_RULES.md` pour les règles de progression et de commission. Depuis la Phase 5,
`placeMember`/`unlockLevel`/`createCommissionEvent` ont leur premier vrai appelant :
`services/payments/activate-registration.ts`, déclenché par un paiement confirmé (webhook Moneroo,
crédit admin, ou paiement par solde) — voir la section Paiements ci-dessous.

## Frontière serveur / client

Un utilisateur ne peut jamais modifier depuis le navigateur : son niveau, ses commissions, son solde,
son parrain, son parent binaire ou ses qualifications.

- Les Server Actions et Route Handlers accèdent à la DB via Drizzle (`src/db/client.ts`,
  `DATABASE_URL`), jamais exposée au client (`import "server-only"`). Cette connexion Postgres
  directe est ce qui fait autorité côté serveur — le projet n'utilise pas la clé API
  `service_role` de Supabase (aucun appel à l'admin API Supabase Auth/Storage pour l'instant ;
  si un besoin apparaît plus tard, l'ajouter alors, avec sa vraie utilisation).
- RLS Supabase reste activée sur toutes les tables comme défense en profondeur ; l'autorisation
  primaire est vérifiée côté service à chaque appel (session → rôle → propriété de la ressource).
- Next.js 16 : les Server Functions (`"use server"`) sont atteignables par POST direct, pas
  seulement via l'UI — chaque service vérifie donc l'authentification/autorisation lui-même,
  jamais uniquement via le proxy (voir `src/proxy.ts`).
- Aucun calcul de commission, de solde ou de progression n'est envoyé au client sans avoir été
  recalculé/vérifié côté serveur.

## Généalogie : adjacency list + `ltree`

`binary_nodes` est l'unique structure de placement, réutilisée par les 5 niveaux (voir
`MLM_RULES.md`). Comparaison retenue :

| Option               | Lecture ancêtres/sous-arbre                | Coût à 10M nœuds                     |
| -------------------- | ------------------------------------------ | ------------------------------------ |
| CTE récursive pure   | O(profondeur), pas d'index sur le résultat | aucun surcoût de stockage            |
| Closure table        | O(1) via jointure indexée                  | jusqu'à ~240M lignes à profondeur 24 |
| **`ltree` (retenu)** | O(log n) via GiST, opérateurs `<@` / `@>`  | 1 colonne indexée par nœud           |

`binary_parent_id` / `binary_position` restent la source de vérité (append-only, jamais réécrits
silencieusement). La colonne `path ltree` est dérivée une seule fois à l'insertion
(`parent.path || node_id`) — jamais recalculée en masse, puisque le placement est immuable.
Deux compteurs incrémentaux (`left_subtree_count`, `right_subtree_count`) évitent de recompter un
sous-arbre à chaque placement (mis à jour par une seule requête `UPDATE ... WHERE path @> new.path`).

L'extension est activée dans `src/db/migrations/0000_enable_extensions.sql`.

### Pseudo public et visualisation de l'arbre

`profiles.username` (migrations `0015`-`0017`) est le pseudo affiché publiquement — distinct de
`full_name`, qui reste privé/administratif. Obligatoire et unique dès l'inscription
(`schemas/auth.ts`), saisi dans le formulaire d'inscription et transmis via les métadonnées
Supabase Auth jusqu'à la création réelle du profil (`ensure-profile.ts`, au moment de la
confirmation d'email — pas à l'instant de l'inscription). Parce que ces deux instants peuvent être
éloignés de plusieurs minutes, la disponibilité du pseudo est vérifiée deux fois : une fois côté
UX à l'inscription (`services/auth/register.ts`, message d'erreur immédiat) et une fois côté
correction silencieuse à la création du profil (`repositories/profiles.ts`,
`insertProfileIfMissing` ajoute un court suffixe si une collision s'est glissée dans l'intervalle,
plutôt que de faire échouer la confirmation d'email d'un utilisateur qui a déjà cliqué le lien).

`/dashboard/network` (Phase 8) rend l'arbre binaire du membre sous forme d'organigramme visuel
(`genealogy-tree.tsx`, `tree-node.tsx`, `binary-connector.tsx`) plutôt que la liste de cartes
utilisée jusque-là : icône de personne colorée (orange pour soi, vert = a atteint le niveau
consulté, gris = pas encore, pointillés = emplacement vacant) avec le pseudo et le nom du niveau
courant du membre affichés dessous, reliée par des connecteurs en « L » — un motif CSS classique
adapté ici au cas fixe de deux enfants par nœud (jamais un nombre arbitraire), donc pas besoin de
mesurer des positions en pixels.

**Sélecteur de niveau** : la profondeur de l'arbre affiché dépend du niveau consulté (2 générations
pour le niveau 1, 3 pour les niveaux 2 à 5 — dérivé de `levels.config.generationSizes.length`, pas
d'une constante), avec par défaut le niveau actuel du visiteur (`?level=N` dans l'URL). `levels.name`
porte désormais de vrais noms de palier (Bronze/Argent/Or/Platine/Diamant, migration `0018`) plutôt
que le placeholder générique « Niveau N » du seed initial.

**Recherche de pseudo** : la barre de recherche du bandeau (`dashboard-topbar.tsx`) cible
`/dashboard/network`, pas `/dashboard/courses` (le formulaire de recherche de cours reste
fonctionnel si on y navigue directement, juste plus l'entrée par défaut). `searchDownlineMembers`
(`repositories/network.ts` → `searchDescendantsByUsername` dans `repositories/binary-nodes.ts`)
cherche dans **toute** la descendance du visiteur, pas seulement les générations affichées par
l'arbre — un membre à la génération 5 doit rester trouvable même quand l'arbre n'en affiche que 2
ou 3. Scopée à la descendance du visiteur (`path <@`), jamais à la plateforme entière.

## Architecture événementielle (outbox)

Vercel est serverless (pas de worker persistant) — on retient un **outbox transactionnel** plutôt
qu'un vrai message bus : chaque changement métier important écrit une ligne dans `domain_events`
dans la même transaction que le changement lui-même ; un dispatcher est invoqué en fin de requête
(best-effort) et une tâche planifiée (Vercel Cron) traite les événements `PENDING` restants.

Types d'événements : `USER_REGISTERED`, `PAYMENT_CONFIRMED`, `USER_PLACED`, `LEVEL_1_COMPLETED`,
`LEVEL_UNLOCKED`, `GENERATION_COMPLETED`, `COMMISSION_CREATED`, `REWARD_UNLOCKED`,
`WITHDRAWAL_REQUESTED`.

## Paiements

Interface `PaymentProvider` dans `services/payments/provider.ts` (`createPayment`, `verifyPayment`,
`parseWebhook`, `refundPayment`) — le reste de l'application ne dépend que de l'interface, jamais
d'un prestataire précis. Implémentation actuelle : Moneroo (`services/payments/moneroo.ts`),
retenu depuis la Phase 5 — endpoints et format de webhook vérifiés contre leur documentation
(docs.moneroo.io) plutôt que suivis de mémoire. `refundPayment` lève une erreur explicite pour
Moneroo : leur documentation ne liste aucun endpoint de remboursement à ce jour.

Trois façons d'activer une inscription, toutes convergeant vers `activateRegistration`
(`services/payments/activate-registration.ts`), le seul endroit qui active un compte : jamais deux
implémentations divergentes de la même règle métier.

- **MOBILE_MONEY** (`initiate-registration-payment.ts`) — le chemin normal : crée un paiement
  Moneroo, redirige vers le checkout. Confirmé uniquement par webhook signé
  (`app/api/webhooks/moneroo/route.ts` → `process-webhook-event.ts`), jamais par le retour
  utilisateur sur `return_url` (section 5 : une intention de paiement n'est pas un paiement validé).
- **ADMIN_CREDIT** (`admin-credit.ts`) — un administrateur valide une inscription sans paiement
  réel. Le rôle ADMIN de l'octroyeur est revérifié à l'intérieur du service (défense en
  profondeur), pas seulement supposé déjà filtré par l'appelant.
- **WALLET** (`wallet-payment.ts`) — un parrain finance l'inscription d'un filleul qu'il parraine
  depuis son solde disponible. Le service vérifie que le payeur est bien le parrain enregistré du
  bénéficiaire (`sponsorships`), pas n'importe quel membre.

Webhooks idempotents via `payment_events.dedupe_key` (unique) — Moneroo ne fournit pas d'ID
d'événement officiel (juste un avertissement que les webhooks peuvent être livrés plusieurs fois),
la clé est donc dérivée par l'adaptateur (`event:transaction_id`), pas prise telle quelle du
payload.

**`Executor` généralisé** : `placeMember`/`createRootNode` (Phase 3) ouvraient à l'origine leur
propre transaction — incompatible avec `activateRegistration`, qui doit les appeler _dans sa
propre_ transaction pour que paiement confirmé + activation + placement + niveau 1 + commission
directe réussissent ou échouent ensemble. Refactorisés pour accepter un `Executor`
(`src/db/executor.ts`), comme `unlockLevel` depuis la Phase 4 — voir `DATABASE.md` pour le détail
du bug qu'aurait causé l'ancienne signature.

## Récompenses matérielles

`services/mlm/reward.ts` (`unlockReward`) existe depuis la Phase 6, câblé dans `completeLevel`
(`services/mlm/unlock-level.ts`) : dès qu'un membre complète le niveau 3, 4 ou 5, toutes les
récompenses actives de ce niveau (`rewards`, filtrées par `level_code` + `is_active`) lui sont
attribuées (`member_rewards`, idempotent via `onConflictDoNothing` sur `(user_id, reward_id)`).

Distinction volontaire par `reward_type` (pas explicite dans le prompt directeur mais déduite de la
section 17 — ne jamais traiter la valeur d'une récompense matérielle comme une commission) :

- `PHYSICAL` / `VOUCHER` / `OTHER` : ne touchent jamais `user_balances` ni
  `financial_transactions` — juste une ligne `member_rewards` à statut `ELIGIBLE`, suivie
  manuellement (adresse de livraison, tracking) jusqu'à `DELIVERED`.
- `CASH` : crédite le solde exactement comme une commission, via la même fonction
  `services/mlm/credit-balance.ts` (`creditBalance`) que `commission.ts` — extraite en Phase 6
  pour que la logique d'upsert de `user_balances` ne diverge jamais entre les deux appelants — et
  écrit une ligne `financial_transactions` de type `REWARD`.

`services/mlm/claim-reward.ts` (`claimReward`, membre : `ELIGIBLE` → `CLAIMED`, adresse de
livraison optionnelle) et `services/mlm/update-reward-delivery-status.ts`
(`updateRewardDeliveryStatus`, admin uniquement, re-vérifié en interne : `PROCESSING` →
`DELIVERED`) n'ont pas encore d'UI — appelés uniquement depuis les scripts de vérification pour
l'instant ; l'UI membre arrive en Phase 8 (`/dashboard/rewards`) et l'UI admin en Phase 9.

## LMS

`repositories/courses.ts` et `services/lms/` existent depuis la Phase 7, scopée strictement à ce
que le prompt directeur nomme pour cette phase : cours, modules, leçons, vidéos, progression, accès
par niveau — pas les quiz/certificats/documents esquissés dans le rapport d'architecture initial
(voir l'écart correspondant dans `DATABASE.md`).

Décision prise en amont, avec l'utilisateur, avant d'écrire le schéma (même démarche que pour
Moneroo en Phase 5) : les vidéos sont hébergées en externe (YouTube non répertorié / Vimeo privé),
`lessons.video_url` stocke l'URL telle quelle — pas de Supabase Storage ni de CDN vidéo dédié, pour
éviter un nouveau prestataire payant. Compromis assumé et documenté : un lien qui fuite hors de
l'application contourne le contrôle d'accès par niveau, puisqu'on masque le lien plutôt que de le
protéger par un token signé expirant.

`repositories/courses.ts` (`hasCourseAccess`) porte toute la logique de contrôle d'accès, pas les
policies RLS (défense en profondeur uniquement, comme partout ailleurs) : un cours sans ligne
`course_levels` est public ; un cours avec des lignes est accessible dès que le membre a débloqué
**au moins un** des niveaux liés (OR, pas AND) ; un admin a toujours accès, pour la relecture de
contenu. `enrollments` n'existe pas comme table séparée — l'accès est recalculé à la demande à
partir de `member_levels` × `course_levels`, jamais mis en cache dans une ligne qui pourrait
diverger (même raisonnement que la suppression de `level_progress`/`commission_rules`).

`lesson_progress` ne connaît qu'un statut binaire (une ligne = terminée, absence = non terminée) —
pas de `IN_PROGRESS` : un embed vidéo externe ne donne aucun signal fiable de temps de lecture,
donc `markLessonComplete` (`services/lms/mark-lesson-complete.ts`) est une action explicite du
membre, pas une inférence depuis la lecture. `services/lms/create-course.ts`/`create-module.ts`/
`create-lesson.ts` (admin uniquement, rôle revérifié en interne comme partout) sont pour l'instant
la seule façon de créer du contenu au-delà du seed de démonstration — pas d'UI de gestion de
contenu côté admin encore (arrive avec la Phase 9) ; la consultation côté membre existe depuis la
Phase 8 (`/dashboard/courses`).

## UI membre (Phase 8)

`/dashboard` devient un vrai hub : `src/app/dashboard/layout.tsx` porte l'en-tête, le bouton de
déconnexion et la navigation (masquée tant que `profile.status !== "ACTIVE"`, puisque
`PENDING_PAYMENT` n'a accès qu'à l'écran de paiement). Chaque sous-page revérifie elle-même
`profile.status === "ACTIVE"` et redirige vers `/dashboard` sinon — pas de garde centralisée
unique, pour rester cohérent avec le reste du projet où chaque service/page revérifie ses propres
préconditions plutôt que de faire confiance à un contrôle en amont.

Nouvelles pages, toutes des Server Components qui lisent directement via les repositories (aucune
n'écrit, sauf les Server Actions listées plus bas) :

- `/dashboard` (vue d'ensemble) : cartes de résumé (solde, niveau actuel, cours accessibles,
  récompenses à réclamer) pointant vers les sous-pages.
- `/dashboard/network` : `repositories/network.ts` (nouveau) compose `binary-nodes.ts` +
  `profiles` pour afficher le sous-arbre du membre sur 2 générations (enfants directs +
  petits-enfants) et ses ascendants dans l'arbre binaire (jusqu'à 3 générations, même fenêtre que
  la propagation du moteur MLM) — pas un explorateur d'arbre complet, volontairement limité à ce
  qu'un membre a besoin de voir sur son réseau immédiat.
- `/dashboard/commissions` : `repositories/financial-transactions.ts` (nouveau) — solde
  (`user_balances`) et historique (`financial_transactions`, 50 dernières lignes).
- `/dashboard/levels` : `repositories/member-levels.ts` (nouveau) — les 5 niveaux avec un statut
  `LOCKED` synthétisé pour l'affichage uniquement (jamais stocké, absence de ligne `member_levels`
  = verrouillé, comme documenté dans `MLM_RULES.md`).
- `/dashboard/rewards` : `repositories/member-rewards.ts` (nouveau, joint `member_rewards` +
  `rewards`) — le bouton « Réclamer » (`claim-reward-form.tsx` → Server Action → `claimReward`)
  ne demande une adresse de livraison que pour les récompenses `PHYSICAL`.
- `/dashboard/courses` et `/dashboard/courses/[courseId]` : `listCoursesForUser` (ajouté à
  `repositories/courses.ts`, différé depuis la Phase 7 faute de page pour l'appeler) pour la liste
  ; `getCourseContent` accepte maintenant un `userId` optionnel pour annoter chaque leçon de
  `completed: boolean` sur la page de détail. Un lien « regarder » ouvre `lessons.video_url` dans
  un nouvel onglet — pas de lecteur intégré ni de parsing par prestataire (YouTube vs Vimeo) : ça
  reste un souci d'UI vidéo pour une phase ultérieure, pas nécessaire pour afficher/suivre la
  progression. Le bouton « Marquer comme terminée » (`mark-complete-button.tsx` → Server Action →
  `markLessonComplete`) déclenche `revalidatePath` sur la page de détail et la liste.

Aucune nouvelle règle métier introduite : cette phase ne fait que lire/afficher ce que les Phases
2 à 7 ont déjà construit, plus les deux Server Actions (`markLessonCompleteAction`,
`claimRewardAction`) qui appellent des services déjà écrits et déjà testés en Phase 6/7 — les
nouvelles fonctions de repository (lecture pure, pas de transaction) ont été vérifiées contre la
vraie base avant de considérer la phase terminée, voir `DATABASE.md`.

## Panneau d'administration (Phase 9)

Périmètre du rapport d'architecture original (relu en cours de Phase 9, mon souvenir compacté
initial en avait perdu une partie) : utilisateurs, paiements, commissions, niveaux, récompenses,
paramètres versionnés, `audit_logs`. Une première passe n'avait construit que Membres et
Récompenses, plus une section Cours non prévue à ce stade (LMS, plus naturellement une extension de
la Phase 7) — le reste (Paiements, Commissions, Niveaux, Paramètres versionnés, `audit_logs`) a été
comblé dans une seconde passe une fois l'écart identifié, voir `DATABASE.md` (« Vérification live —
Phase 9 complément »). Un module « litiges » avait aussi été évoqué comme hypothèse lors de la
clarification de cette phase, mais n'a **aucune** table ni règle métier existante pour s'y
accrocher — plutôt que d'inventer un schéma de dispute non spécifié, il reste explicitement hors
périmètre ; à construire dans une phase dédiée si le besoin se précise.

`src/app/admin/layout.tsx` gate tout le sous-arbre `/admin` avec `requireAdmin()`
(`services/auth/current-user.ts`, existe depuis la Phase 2, jusqu'ici sans appelant) — redirige
silencieusement vers `/dashboard` pour un non-admin, pas d'écran « accès refusé » séparé.

- **Membres** (`/admin/members`, `/admin/members/[userId]`) : `repositories/admin-members.ts`
  (nouveau, `listMembers`) agrège profil + email (`auth.users`, via `listAuthEmails`, nouveau dans
  `repositories/auth-users.ts`) + niveau actuel + solde en 3 requêtes batchées, pas du N+1. La page
  de détail réutilise **telles quelles** les fonctions de lecture de la Phase 8
  (`getBalance`, `listLevelProgress`, `listMemberRewards`, `getNetworkView`, `listTransactions`) en
  leur passant l'id du membre consulté plutôt que celui de l'appelant — elles n'ont jamais été
  couplées à « l'utilisateur courant », donc aucune modification n'a été nécessaire pour les
  réutiliser côté admin. Nouveau service `services/admin/set-member-status.ts` (`setMemberStatus`) :
  rôle ADMIN revérifié, refuse qu'un admin se suspende lui-même, refuse de suspendre un compte
  encore `PENDING_PAYMENT` (rien à suspendre).
- **Trou comblé** : `SUSPENDED` existait dans `profile_status` depuis la Phase 2 mais n'était géré
  nulle part — un membre suspendu voyait quand même la vue d'ensemble de son dashboard (juste sans
  navigation). `src/app/dashboard/page.tsx` a maintenant une branche dédiée (message « compte
  suspendu », aucune donnée) avant la branche générale ; combinée à la garde déjà existante de
  chaque sous-page (Phase 8, `status !== "ACTIVE"` → redirection), suspendre un compte a maintenant
  un effet réel.
- **Contenu LMS** (`/admin/courses`, `/admin/courses/new`, `/admin/courses/[courseId]`) :
  `listAllCoursesForAdmin` (nouveau dans `repositories/courses.ts`) — vue de gestion, pas liée à un
  membre particulier (contrairement à `listCoursesForUser`), inclut les cours/modules/leçons
  inactifs. Les formulaires appellent directement `createCourse`/`createModule`/`createLesson`
  (Phase 7, déjà protégés par rôle en interne) via des Server Actions fines.
- **Récompenses** (`/admin/rewards`) : `listAllMemberRewards` (nouveau dans
  `repositories/member-rewards.ts`) — même jointure que la version membre de la Phase 8, plus le
  nom du membre. Les boutons d'action appellent `updateRewardDeliveryStatus` (Phase 6).
- **Paiements** (`/admin/payments`) : `listPayments` (nouveau dans `repositories/payments.ts`) —
  toutes les intentions/confirmations de paiement, bénéficiaire/payeur/octroyeur résolus en noms
  par une seule requête batchée sur `profiles`. Lecture seule ; aucune action admin sur un paiement
  au-delà de ce qu'`grantAdminCredit` (Phase 5) fait déjà.
- **Commissions** (`/admin/commissions`) : `listCommissionEvents` (nouveau dans
  `repositories/commission-events.ts`) — le flux `commission_events` (l'idempotency gate), pas
  `financial_transactions` (déjà consultable par membre en Phase 8). Lecture seule.
- **Niveaux** (`/admin/levels`) : `getLevelStats` (nouveau dans `repositories/member-levels.ts`) —
  comptage `IN_PROGRESS`/`COMPLETED` par niveau, à l'échelle de la plateforme. Délibérément lecture
  seule : exposer une UI pour modifier `levels.config.generationSizes` une fois des membres déjà en
  progression changerait rétroactivement ce que « compléter » ce niveau signifie pour des
  `generation_progress` déjà en cours — un risque du même ordre que modifier un
  `parameter_versions` en place, mais sans le garde-fou de versionnement que `parameter_versions` a
  déjà. Si ce besoin apparaît, il mérite sa propre conception délibérée (nouvelle colonne
  versionnée sur `levels`, ou une table `level_versions` séparée), pas un formulaire ajouté vite.
- **Paramètres versionnés** (`/admin/parameters`) : nouveau service
  `services/admin/update-parameter.ts` (`updateParameter`) — ne met **jamais** à jour une ligne
  `parameter_versions` en place (section 29/43, non-rétroactivité) : ferme la ligne actuellement
  effective (`effective_to = now()`) puis insère la nouvelle avec `effective_from` fixé à **cette
  même valeur exacte** capturée via `RETURNING`, pas un second appel indépendant à `now()` — pour
  garantir qu'il n'existe jamais de trou ni de chevauchement entre deux versions consécutives d'un
  même paramètre. `repositories/parameter-versions.ts` (`listCurrentParameters`) affiche la version
  effective de chacune des 7 clés seedées.
- **Journal d'audit** (`/admin/audit-logs`, table `audit_logs`, migrations `0013`/`0014`) :
  `services/admin/audit-log.ts` (`logAdminAction`) est appelé **à l'intérieur de la même
  transaction** que l'action qu'il journalise, dans les 6 services admin existants
  (`setMemberStatus`, `createCourse`/`createModule`/`createLesson`, `updateRewardDeliveryStatus`,
  `grantAdminCredit`, `updateParameter`) — une entrée de journal ne peut donc jamais exister sans
  que l'action ait réellement eu lieu, ni l'inverse. Pas de `ON DELETE CASCADE` depuis `profiles`
  (même raisonnement que le ledger financier, section 19) : un journal d'audit ne doit pas
  disparaître parce que le compte qui a agi est supprimé plus tard.

Aucune nouvelle règle métier financière introduite au-delà de la non-rétroactivité déjà établie
pour `parameter_versions` — cette phase construit une UI et deux nouveaux services (changement de
statut, mise à jour de paramètre + traçabilité) par-dessus des règles déjà validées dans les phases
précédentes.

## Tests & optimisation (Phase 10)

Stratégie complète dans `TESTING.md` (nouveau). Décision prise avec l'utilisateur : pas de
simulation à 32 767 comptes (scénario G0→G14 du prompt directeur) — le texte exact de cette
exigence n'a pas survécu à la compaction de contexte, et la base de développement contient
désormais un vrai compte propriétaire de l'unique racine de l'arbre, ce qui rend impossible de
construire un arbre de test isolé à cette échelle sans soit polluer le compte réel de façon
irréversible (les compteurs de sous-arbre ne peuvent pas être décrémentés après coup), soit violer
la règle du nœud racine unique. À la place : suite de tests unitaires purs élargie (47 tests),
tests E2E Playwright élargis (8 tests, `e2e/admin.spec.ts` nouveau), et `EXPLAIN ANALYZE` des
requêtes `ltree`/recherche critiques (résultats et recommandation `pg_trgm` dans `TESTING.md`).

`SECURITY.md` et `FINANCIAL_MODEL.md` (dus respectivement depuis les Phases 2 et 4-5, jamais
écrits) sont également rédigés dans cette phase, documentant ce qui a réellement été construit.

## Transferts entre membres

Ajouté après la Phase 10, à la demande explicite de l'utilisateur (voir `MLM_RULES.md`). Interface
`EmailProvider` (`services/notifications/provider.ts`, une seule méthode `sendEmail`) — même
pattern que `PaymentProvider` (section Paiements ci-dessus) : le reste de l'application ne dépend
que de l'interface. Implémentation actuelle : Resend (`services/notifications/resend-email.ts`),
retenu pour la même raison que Moneroo en Phase 5 — endpoint et format de requête vérifiés contre
`resend.com/docs` plutôt que suivis de mémoire. Aucun compte Resend réel n'existe encore
(`RESEND_API_KEY` en placeholder dans `.env.local`, comme `MONEROO_SECRET_KEY` avant lui) — l'appel
réseau lui-même n'a donc pas pu être vérifié de bout en bout, seulement son échec propre (401,
message d'erreur exploitable) en vérification live.

Deux services (`services/wallet/`) :

- **`initiateTransfer(senderId, recipientUsername, amount)`** — valide les règles métier (montant
  entier positif, destinataire existant/`ACTIVE`/différent de l'émetteur, solde suffisant), expire
  toute demande `PENDING_OTP` encore ouverte pour cet émetteur (jamais deux codes valides à la
  fois), crée la ligne `wallet_transfers`, envoie l'email. L'insertion précède l'envoi d'email —
  vérifié en conditions réelles : même quand Resend échoue (pas de compte réel), la ligne existe
  déjà en base avec un `otp_code_hash` et une expiration correctes.
- **`confirmTransfer(senderId, transferId, code)`** — voir `services/wallet/otp.ts` (génération
  `crypto.randomInt`, hash SHA-256, comparaison `timingSafeEqual`, même rigueur que la vérification
  de signature Moneroo). Découpé en **deux phases distinctes, jamais une seule transaction** :
  1. Validation du code contre la ligne encore `PENDING_OTP`, en dehors de toute transaction
     explicite. Un code faux ou une ligne expirée/épuisée doit **persister** sa pénalité
     (incrément de tentative, ou passage à `EXPIRED`) — si cette étape était dans la même
     transaction que le mouvement d'argent et qu'on levait une erreur pour signaler l'échec au
     client, Postgres annulerait aussi l'incrément de tentative, et la limite ne mordrait jamais.
  2. Seulement une fois le code connu valide : une transaction unique qui fait basculer
     `PENDING_OTP` → `CONFIRMED` derrière une clause `WHERE status = 'PENDING_OTP'` (empêche une
     double confirmation concurrente de gagner deux fois), débite l'émetteur derrière une clause
     `WHERE available_balance >= amount` (ferme la fenêtre TOCTOU que `wallet-payment.ts` laisse
     ouverte avec sa vérification en lecture séparée — observation notée mais `wallet-payment.ts`
     lui-même n'a pas été retouché, hors périmètre de cette demande), crédite le destinataire via
     `creditBalance` (le même helper partagé que les commissions/récompenses), écrit les deux
     lignes `financial_transactions` (`TRANSFER_SENT`/`TRANSFER_RECEIVED`).

**Vérifié en conditions réelles** (script temporaire, 2 comptes de test, nettoyés) : les 5
validations d'`initiateTransfer`, l'expiration automatique de la demande précédente, le blocage
après 5 tentatives de code erroné (le 6e appel est rejeté sans même vérifier le code), le flux
nominal complet (soldes débité/crédité, deux lignes de ledger liées par
`sender_transaction_id`/`recipient_transaction_id`), le rejet d'un rejeu sur un transfert déjà
`CONFIRMED`, le rejet d'un code expiré, et — le cas le plus délicat — un solde devenu insuffisant
entre la création de la demande et sa confirmation : la transaction complète s'annule (le
basculement `CONFIRMED` déjà fait dans la même transaction repart bien à `PENDING_OTP`, pas de
statut incohérent). 35 assertions, aucun bug trouvé dans le code applicatif.

## Pivot formation + programme ambassadeur — schéma (Phase 11, en cours)

Évolution majeure demandée : séparer le client (peut acheter et suivre des formations sans jamais
rejoindre le réseau) de l'ambassadeur (rejoint gratuitement, gagne des commissions sur de vraies
ventes plutôt que sur le recrutement). Audit complet et 4 décisions produit validées avec
l'utilisateur avant tout code — voir le résumé dans `MLM_RULES.md`. Cette section documente
uniquement ce qui existe **réellement** à ce stade : le schéma, rien de plus. Aucun service ne lit
ni n'écrit encore ces tables — `activate-registration.ts`, `unlock-level.ts`, `hasCourseAccess`
fonctionnent exactement comme avant, inchangés.

**Nouvelles tables** (migration `0021_business_model_schema.sql` + backfill
`0022_business_model_backfill.sql`) :

- `ambassador_profiles` — l'existence d'une ligne, pas un champ sur `profiles`, est ce qui définit
  « être ambassadeur » (même convention que `member_levels`). `referral_code` unique (seedé depuis
  `username`), `terms_accepted_at`/`terms_version` pour l'opt-in explicite (jamais silencieux).
- `sales` — le pendant commercial d'un achat de formation, distinct de `payments` (la couche
  intention/provider) : n'existe qu'une fois le paiement `CONFIRMED`, jamais avant. `price_paid`/
  `business_volume` sont des instantanés au moment de la vente, jamais recalculés si le prix/BV de
  la formation change ensuite (non-rétroactivité, même principe que `commission_events`).
  `ambassador_user_id` nullable : un achat direct sans parrainage est un état normal, pas une
  anomalie (section 9 du prompt directeur).
- `referral_clicks` — table de tracking dédiée (choisie explicitement sur un simple cookie) : une
  ligne par clic sur un lien `/r/{referralCode}`, pas seulement le dernier cookie actif. Une vente
  résout son attribution via le clic le plus récent pour le même `visitor_token`, dans une fenêtre
  configurable (`parameter_versions` clé `attribution.cookie_days`, pas encore créée).
- `commission_rules` — remplace le futur besoin d'un simple `parameter_versions` clé-valeur par un
  moteur structuré et versionné (même non-rétroactivité que `parameter_versions` : jamais modifié
  en place). `scope` distingue `DIRECT_SALE` (par formation/catégorie) de `GENERATION` (par
  niveau/génération). `rate` est en points de base (1/100 de %) pour `PERCENTAGE`/`BV_PERCENTAGE` —
  ex. `800` = 8,00 % — pour rester un entier (aucun flottant, XOF n'a pas de sous-unité) tout en
  permettant un pourcentage fractionnaire ; pour `FIXED`, `rate` est un montant F CFA brut.
- `refunds` — jamais une suppression : l'annulation réelle d'une commission passera par une ligne
  `financial_transactions` de type `COMMISSION_REVERSAL` (ajouté à l'enum, pas encore écrit par
  aucun service) ; `refunds` n'est que la trace administrative de la décision (qui, pourquoi,
  accès révoqué ou non).

**Colonnes ajoutées à des tables existantes** :

- `courses` — `slug`, `price`, `business_volume`, `category`, `thumbnail_url`,
  `duration_minutes`, `status`. Toutes nullable pour l'instant, y compris `slug` : le rendre
  obligatoire aurait cassé `services/lms/create-course.ts` (qui ne génère pas encore de slug),
  contraire à l'objectif « zéro changement de comportement » de cette phase — même précédent que
  la colonne `username` (nullable → backfill → `NOT NULL`, jamais en une seule étape risquée).
  `status` coexiste avec `is_active` sans le remplacer ; la réconciliation des deux est repoussée à
  la phase qui réécrit vraiment `hasCourseAccess`.
- `generation_progress` — `bv_total` (entier, défaut 0), à côté de `current_count` : le nouveau
  critère de qualification (présence et/ou BV minimum, lu depuis `commission_rules`) remplacera le
  seuil `current_count >= required_count` codé en dur dans `unlock-level.ts`, dans une phase
  ultérieure — cette colonne ne fait que préparer la place.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 16 assertions — slug backfillé
correctement sur l'unique cours seedé, contrainte d'unicité de `referral_code` bien rejetée sur
doublon, insertion réussie dans les 5 nouvelles tables avec leurs clés étrangères croisées
(`sales.attribution_id → referral_clicks`, `refunds.sale_id → sales`, etc.), les deux nouvelles
valeurs d'enum (`payment_purpose.COURSE_PURCHASE`, les 3 ajouts à
`financial_transaction_type`) acceptées, `generation_progress.bv_total` présent avec le bon
défaut. Nettoyage complet re-vérifié par une lecture après suppression.

## Programme ambassadeur : l'opt-in gratuit (Phase 11, suite)

`services/ambassador/join-program.ts` — la première brique de logique métier du pivot.
Volontairement indépendante d'`activate-registration.ts`, qui continue de fonctionner exactement
comme avant, non modifié : les deux chemins coexistent, aucun des deux n'appelle l'autre.

**Ce que fait `joinAmbassadorProgram(userId, { sponsorUsername?, termsVersion })`**, dans une seule
transaction (même discipline d'atomicité qu'`activate-registration.ts`, sans étape de paiement) :

1. Refuse un compte `SUSPENDED`.
2. Idempotent — si une ligne `ambassador_profiles` existe déjà, la retourne telle quelle (garde de
   convenance en amont + `onConflictDoNothing` dans la transaction pour le vrai verrou contre un
   double appel concurrent).
3. Résout le parrain : réutilise en priorité la ligne `sponsorships` déjà enregistrée à
   l'inscription (`services/auth/register.ts`, `sponsorEmail` optionnel) — append-only, jamais
   réassignée. Si aucune n'existe, `sponsorUsername` s'applique (permet à quelqu'un inscrit sans
   parrain, en simple client, d'en nommer un plus tard en rejoignant le programme).
4. Si un parrain est résolu, vérifie qu'il a lui-même une ligne `ambassador_profiles` `ACTIVE` —
   sinon rejet explicite. Sans parrain, `createRootNode` (réservé au tout premier ambassadeur de la
   plateforme, échoue si une racine existe déjà).
5. Place dans l'arbre (`placeMember`/`createRootNode`) et débloque le niveau 1 (`unlockLevel`) —
   les mêmes fonctions qu'`activate-registration.ts`, aucune duplication de logique de placement.
6. **Aucune commission n'est versée** — changement de règle assumé (section 11 du prompt
   directeur) : la commission directe n'est plus liée au recrutement, seulement à une vente
   éligible future. `join-program.ts` n'appelle jamais `createCommissionEvent`.
7. Fait passer `profiles.status` à `ACTIVE` si besoin (une sous-page du tableau de bord l'exige
   aujourd'hui) — la refonte complète du sens de `PENDING_PAYMENT` maintenant que l'inscription est
   gratuite reste une décision à trancher séparément (voir `MLM_RULES.md`), non résolue
   silencieusement ici : cette ligne ne couvre que le seul cas que cette fonction crée elle-même.

**Piège trouvé et corrigé avant même d'écrire le script de vérification** : `assignSponsor`
ouvrait sa propre connexion (`db`, pas un `Executor`) — exactement le bug déjà documenté en Phase 5
pour `placeMember`/`createRootNode` (écriture hors de la transaction englobante, donc non annulée
par un rollback). Corrigé en lui faisant accepter un `Executor`, comme le reste du moteur ; son seul
appelant existant (`app/auth/callback/route.ts`) passe désormais `db` explicitement — comportement
strictement identique, juste explicite.

**Vérifié en conditions réelles** (18 assertions au total, script temporaire nettoyé) — avec une
contrainte inattendue : un vrai compte s'était activé pour de vrai (chemin
`activate-registration.ts`, toujours actif) entre la vérification de la Phase 1 et celle-ci, et
détenait déjà l'unique racine. Migration `0023_ambassador_backfill_catchup.sql` (rejoue le backfill
idempotent de `0022` pour ce compte, qui n'existait pas encore au moment où `0022` a tourné) écrite
et appliquée avant de continuer — documenté plutôt que contourné en silence. Le script traite ce
compte réel en lecture seule (jamais modifié, utilisé uniquement comme vrai parrain pour des
comptes de test jetables) : rejet d'un 2e membre sans parrain (racine déjà prise, aucune trace
laissée par le rollback), placement réussi d'un filleul de test sous ce compte réel, pseudo de
parrain inconnu rejeté, auto-parrainage rejeté, parrain non-ambassadeur rejeté, compte suspendu
rejeté, idempotence confirmée. Nettoyage limité aux comptes de test — la racine réelle vérifiée
intacte après coup.

## Catalogue de formations vendables + achat direct (Phase 11, suite)

`services/lms/create-course.ts` (étendu) et `update-course-pricing.ts` (nouveau) donnent enfin un
prix et un BV réels aux formations — auparavant `courses` n'avait ni l'un ni l'autre, l'accès étant
uniquement conditionné par le niveau MLM. `slug` est désormais dérivé automatiquement du titre à la
création (`lib/utils.ts`, `slugify`), avec exactement la même règle que le backfill SQL de la
migration 0022 — les deux ne doivent jamais diverger.

**`services/sales/initiate-course-purchase.ts` / `confirm-course-purchase.ts`** — le pendant
d'`initiate-registration-payment.ts`/`activate-registration.ts` pour un achat de formation, avec
les mêmes garanties non négociables : le prix/BV viennent de la ligne `courses` elle-même (jamais
un paramètre global — section 7), la confirmation ne se produit jamais autrement que via le webhook
signé, et `confirmCoursePurchase` est idempotent (un paiement déjà `CONFIRMED` est un no-op). Le
`courseId` associé à un paiement est porté par `payments.metadata` (colonne jsonb déjà existante,
jamais utilisée par le code applicatif jusqu'ici — seulement transmise telle quelle au provider) :
`payments` reste volontairement agnostique du `purpose`, réutilisée par `REGISTRATION` comme par
`COURSE_PURCHASE`.

**`process-webhook-event.ts` branche désormais sur `payment.purpose`** : `COURSE_PURCHASE` va vers
`confirmCoursePurchase`, tout le reste (dont `REGISTRATION`) continue vers `activateRegistration`,
comportement strictement inchangé. Un seul point d'entrée webhook, deux issues indépendantes.

**Aucune commission, aucun ambassadeur associé** — délibéré, conforme au TEST 6 du prompt
directeur : un achat direct ne doit jamais inventer de parrain ni déclencher de paiement.
L'attribution (`referral_clicks`) et la commission qu'elle déclenchera sont une phase ultérieure,
posée par-dessus cette fonction, jamais dupliquée dedans.

**`hasCourseAccess`/`listCoursesForUser` gagnent un chemin d'accès par achat** (`sales` confirmée),
en plus du chemin par niveau existant — additif, le chemin par niveau n'est pas retiré (section 27,
suppression seulement après validation explicite de la direction « achat obligatoire pour tous »
déjà actée avec l'utilisateur, mais pas encore exécutée).

**Portée volontairement corrigée sur deux pages** : `/dashboard/courses` et
`/dashboard/courses/[courseId]` gardaient un garde-fou `profile.status !== "ACTIVE"` hérité de
l'ancien modèle (où seul un compte ayant payé l'inscription pouvait rien voir) — sous le nouveau
modèle, un simple client qui n'a jamais rejoint le programme ambassadeur doit pouvoir parcourir et
acheter des formations. Remplacé par un garde-fou sur `SUSPENDED` uniquement, sur ces deux pages
seulement — les autres sous-pages du tableau de bord (réseau, commissions, niveaux, transferts)
restent à juste titre réservées aux ambassadeurs `ACTIVE`, non touchées.

**Piège rencontré en écrivant le script de vérification, pas dans le code applicatif** : la clé API
Moneroo dans `.env.local` est actuellement invalide (401 « Invalid API Key » — signalé séparément à
l'utilisateur, sans lien avec ce chantier), donc l'appel HTTP réel de `monerooProvider.createPayment`
n'a pas pu être exercé. Le script construit directement la ligne `payments` que
`initiateCoursePurchase` aurait produite pour tester tout le reste (confirmation, accès,
idempotence) avec les vraies fonctions ; les deux rejets qui se produisent *avant* l'appel Moneroo
dans `initiateCoursePurchase` (cours sans prix, achat en double) ont eux bien été exercés pour de
vrai. Un deuxième piège, dans le script celui-là : le nettoyage doit supprimer `payment_events`
avant `payments` (FK non cascadante), et `audit_logs` avant de supprimer un profil de test
administrateur (même contrainte déjà rencontrée pour d'autres tables non cascadantes).

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 26 assertions — slug auto-dérivé à
la création, prix/BV enregistrés séparément, aucun accès avant achat (cours réservé au niveau 3),
paiement `PENDING` puis `CONFIRMED` via le vrai dispatch du webhook, ligne `sales` avec le bon
instantané prix/BV, **zéro ligne `commission_events`/`financial_transactions`** générée par cet
achat, accès accordé après coup (`hasCourseAccess` et `listCoursesForUser` cohérents), rejeu du même
événement webhook sans doublon, rejeu direct de `confirmCoursePurchase` sans doublon, un deuxième
achat du même cours refusé, achat d'un cours sans prix refusé.

## Attribution + commission sur vente directe (Phase 11, suite)

**`referral_clicks` : une ligne par clic, pas juste un cookie** — décision produit tranchée avec
l'utilisateur (voir `MLM_RULES.md`). `services/attribution/resolve-referral.ts` expose deux
fonctions : `recordReferralClick` (appelée par `app/r/[code]/route.ts`, la route publique du lien
de parrainage — `/r/{referralCode}`, avec `?course={id}` optionnel) crée la ligne et renvoie un
`visitorToken` opaque posé comme cookie httpOnly ; `resolveAttribution` le relit plus tard et
retrouve le clic le plus récent encore dans la fenêtre configurable (`parameter_versions` clé
`attribution.cookie_days`, seedée à 30 par la migration 0025 — pas une valeur du prompt directeur,
un défaut raisonnable, modifiable côté admin). Un code inconnu ou un ambassadeur suspendu ne pose
simplement pas de cookie — jamais une erreur visible au visiteur.

**Résolue à l'initiation, jamais à la confirmation** — piège évité, pas rencontré en le corrigeant :
le webhook qui confirme un paiement est appelé par le serveur de Moneroo, qui n'a évidemment pas
accès aux cookies du navigateur de l'acheteur. `initiateCoursePurchase` doit donc résoudre
l'attribution *maintenant*, pendant qu'un contexte de requête existe encore, et la porter jusqu'à la
confirmation via `payments.metadata` (`{ courseId, ambassadorUserId, attributionId }`) — même
mécanisme que `courseId` déjà en place depuis la phase précédente, juste étendu.

**`commission_rules` sert enfin à quelque chose** : `repositories/commission-rules.ts` résout la
règle `DIRECT_SALE` la plus spécifique (formation exacte → catégorie → règle par défaut) et calcule
le montant (`computeDirectSaleCommission`, fonction pure, testée unitairement) — `rate` est en
points de base pour `PERCENTAGE`/`BV_PERCENTAGE` (800 = 8,00 %), un montant F CFA brut pour `FIXED`,
un `cap` optionnel plafonne dans tous les cas. `services/admin/create-direct-sale-rule.ts` verse
cette configuration dans une interface admin (`/admin/commission-rules`) avec la même discipline de
non-rétroactivité que `update-parameter.ts` : créer une règle pour une portée déjà couverte ferme
l'ancienne à cet instant précis plutôt que de la réécrire.

**`confirmCoursePurchase` paie la commission dans la même transaction que la vente** — si un
ambassadeur a été résolu ET qu'une règle s'applique, `createCommissionEvent` (étendu avec un
nouveau type `DIRECT_SALE`, ledger `DIRECT_SALE_COMMISSION`) crédite son solde, avec `dedupeKey =
DIRECT_SALE:{saleId}` : la vente elle-même est le verrou d'idempotence, pas un mécanisme séparé. Un
auto-parrainage (l'acheteur utilise son propre lien) n'est jamais rejeté — la vente aboutit
normalement, l'attribution est simplement ignorée, aucune commission versée à soi-même.

**Portée assumée pour cette phase** : le lien de parrainage lui-même (`/r/{code}`) est un vrai
point d'entrée fonctionnel — n'importe quel ambassadeur peut déjà le construire à la main
(`referralCode` = son pseudo par défaut). Pas encore d'interface dédiée pour le copier/partager
au-delà de son affichage brut sur `/dashboard/commissions` — même précédent que `join-program.ts`
en Phase 11 (service avant polish, la Phase 7 du plan validé regroupe l'exposition UI finale).

**Piège rencontré en Next.js 16** : `RouteContext<"/r/[code]">` (le type généré recommandé par la
doc pour typer un route handler dynamique) n'existe pas tant que `next dev`/`next build`/
`next typegen` n'a pas tourné au moins une fois après la création du fichier de route — `npx next
typegen` régénère les types sans lancer un build complet.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 24 assertions — code de parrainage
inconnu/ambassadeur suspendu sans effet, clic résolu vers le bon ambassadeur, TEST 3 (vente
attribuée, commission de 2 000 F versée, source = l'acheteur, aucune ligne de ledger pour
l'acheteur lui-même) intégralement rejoué avec les vraies fonctions, idempotence sur rejeu du
webhook **et** sur un second appel direct à `confirmCoursePurchase`, TEST 4 (même cookie, 2e achat
d'une formation différente : attribué mais sans commission tant qu'aucune règle ne s'applique, puis
commission versée via une règle par défaut ajoutée après coup — 10 % de 5 000 F = 500 F, vérifié),
auto-parrainage neutralisé sans bloquer la vente, fenêtre d'attribution expirée (60 jours vs 30 par
défaut) refusée.

## Retraits (post-Phase 11, hors plan initial)

Trois couches, construites et vérifiées d'affilée : schéma + services (Phase A), interface membre
(Phase B), interface admin (Phase C). Détail des montants/soldes dans `FINANCIAL_MODEL.md` ; ici,
la mécanique.

**Décision d'architecture assumée** : aucune intégration de paiement sortant Moneroo n'existe (clé
placeholder, voir `env.moneroo.ts`) — les retraits sont donc **validés manuellement par un admin**,
pas versés automatiquement. `withdrawal_requests` (nouvelle table, migration 0028) modélise ce
cycle : `PENDING_OTP` → `PENDING_REVIEW` (après confirmation OTP par le membre) → `PAID` ou
`REJECTED` (décision admin). Un montant minimum est lu depuis `parameter_versions` (clé
`withdrawal.minimum_amount`, seedée à 2 000 F par la migration 0029 — même mécanisme que
`attribution.cookie_days`, admin-modifiable sans redéploiement).

**`services/wallet/request-withdrawal.ts` / `confirm-withdrawal.ts`** — calqués presque à
l'identique sur `initiate-transfer.ts`/`confirm-transfer.ts` (même module `wallet/otp.ts`, même
garde `WHERE available_balance >= amount` fermant le TOCTOU). La différence : une confirmation ne
crédite personne. Elle déplace le montant de `available_balance` vers `pending_balance` et insère
une ligne `financial_transactions` (`WITHDRAWAL`, montant négatif, `status = PENDING`) —
`financial_transactions.status`, un enum posé dès Phase 1 (`PENDING`/`COMPLETED`/`REVERSED`) mais
jamais utilisé jusqu'ici (chaque écriture antérieure était instantanée), sert enfin à son usage
prévu : représenter un mouvement en attente d'issue.

**`services/admin/approve-withdrawal.ts` / `reject-withdrawal.ts`** — une fois le virement mobile
money envoyé manuellement, l'admin clique « Marquer comme payé » : `pending_balance` →
`withdrawn_balance`, ligne de ledger `PENDING` → `COMPLETED`. Un refus restitue les fonds à
`available_balance` et passe la ligne à `REVERSED` — **jamais une nouvelle ligne compensatoire**,
contrairement à `refundSale` (le remboursement d'une vente confirmée) : rien n'a réellement quitté
la plateforme, donc corriger le statut de la ligne existante suffit plutôt que d'en ajouter une
seconde. Conséquence directe : `repositories/financial-transactions.ts`'s `getBalanceHistory`
(la somme brute du ledger utilisée par le graphique du tableau de bord) doit désormais exclure les
lignes `REVERSED` de sa somme — sans quoi un retrait refusé apparaîtrait pour toujours comme de
l'argent parti. Une ligne `PENDING` compte en revanche normalement : l'argent est réellement sorti
de `available_balance` dès la confirmation, que l'admin l'ait déjà validée ou non.

**Interface membre** (`/dashboard/withdrawals`, Phase B) — formulaire montant + numéro mobile money
→ étape OTP → confirmation, copie conforme du flux `dashboard/transfer` (mêmes composants, même
convention de retour `{error}` plutôt qu'un `throw` brut, l'échec d'OTP étant un cas attendu du
flux, pas un bug). Liste des demandes passées sous le formulaire (les lignes encore `PENDING_OTP`
sont filtrées — un état éphémère déjà représenté par le formulaire lui-même, pas une entrée
d'historique utile).

**Interface admin** (`/admin/withdrawals`, Phase C) — file d'attente des demandes
`PENDING_REVIEW` uniquement (les autres statuts n'ont plus besoin d'action), avec le nom du membre
joint via `repositories/withdrawals.ts`'s `listPendingWithdrawalRequestsForAdmin` (même patron de
jointure que `listSalesForAdmin`). Bouton « Marquer comme payé » ou refus avec motif obligatoire,
même composant `ReviewActions` que `RefundButton` sur `/admin/sales`.

**Vérifié en conditions réelles** (script temporaire, nettoyé, solde de test entièrement retiré
après coup via les mêmes fonctions réelles) : 29 assertions — garde-fous de `requestWithdrawal`
(compte inactif/inconnu, montant sous le minimum, solde insuffisant, numéro invalide, ligne
`PENDING_OTP` bien créée même quand l'envoi d'email échoue faute de vraie clé Resend — même
limitation de vérification que le reste du projet avec cette clé), cycle complet
demande → confirmation OTP → validation admin (soldes `pending`/`withdrawn` corrects, ligne de
ledger `COMPLETED`) et demande → confirmation → refus admin (fonds restitués, ligne `REVERSED`),
mauvais code OTP rejeté, double confirmation et double validation rejetées, validation par un
non-admin rejetée, motif de refus obligatoire, exclusion des lignes `REVERSED` par
`getBalanceHistory` confirmée par le calcul (une ligne `REVERSED` incluse par erreur aurait donné
-4 000 au lieu de -2 500 sur la somme du jour).

**Règle `DIRECT_SALE` par défaut activée (post-Phase 11, hors plan initial)** : jusqu'ici aucune
règle n'existait (0 ligne `DIRECT_SALE`, contre 14 lignes `GENERATION` déjà configurées) — un
ambassadeur touchait 0 F sur ses propres ventes. Une règle globale (`courseId`/`category` tous deux
omis, donc la résolution par défaut de `getEffectiveDirectSaleRule` pour toute formation sans règle
plus spécifique) a été créée via `createDirectSaleCommissionRule` : `PERCENTAGE`, `rate = 2000`
(20,00 %), sans `cap`. Valeur choisie au-dessus du taux de génération 2 (10 %) pour que l'effort de
vente directe reste toujours mieux récompensé qu'un simple effet de structure — exemple raisonnable
et modifiable, même logique que les 14 règles `GENERATION`. Vérifié en conditions réelles (script
temporaire, nettoyé) : `listEffectiveDirectSaleRules` 0 → 1 ligne, `computeDirectSaleCommission`
conforme (9 900 F payés → 1 980 F).

## Moteur de qualification par génération basé sur le BV (Phase 11, suite)

Le seuil codé en dur `currentCount >= requiredCount` (Phase 4-10) est remplacé par un critère
configurable — sans rien casser pour les niveaux/générations où aucune règle n'a été créée.

**`maybeCompleteGeneration`, extraite de l'ancien `incrementGeneration`** — le vrai changement
structurel de cette phase. Elle est maintenant appelée par **deux** déclencheurs indépendants qui
peuvent chacun être celui qui franchit le seuil en dernier :

- `incrementGeneration` (inchangée) — toujours le déclencheur rattrapage/propagation existant,
  quand un membre atteint un niveau.
- `incrementGenerationBv` (nouvelle) — appelée par `services/mlm/propagate-sale-volume.ts` quand
  une vente confirmée a un ambassadeur attribué : le BV remonte jusqu'à 3 générations au-dessus de
  l'ambassadeur (même parcours `findAncestors` que la propagation historique), créditant **toutes**
  les lignes `generation_progress` de cet ascendant à la génération relative correspondante — une
  même position physique compte pour les niveaux 2, 3, 4 et 5 en même temps (MLM_RULES.md), donc une
  seule vente peut créditer plusieurs lignes de niveaux différents d'un coup.

Les deux se terminent par le même verrou atomique (`UPDATE ... WHERE status = 'PENDING'`) : peu
importe lequel des deux franchit le seuil en dernier, la complétion ne peut arriver qu'une fois.

**`repositories/commission-rules.ts` — `isGenerationQualified`** (fonction pure, testée
unitairement) : sans règle `commission_rules` configurée pour ce (niveau, génération), ou avec une
règle dont `qualificationRequirement` est vide, le comportement historique est préservé à
l'identique (présence seule). Une règle avec `minBv` seul bascule sur le BV seul ; avec `presence`
ET `minBv`, les deux sont exigés. `computeGenerationCommission` : `FIXED` reste `taux × taille de
la génération` (même sémantique que l'ancien calcul), `BV_PERCENTAGE` prend un pourcentage du
`bvTotal` accumulé — `PERCENTAGE` n'est délibérément pas proposé à ce niveau (pas de notion de
« prix » unique sur une génération, contrairement à une vente individuelle).

**Deux types de ledger pour une même mécanique, une distinction volontaire** : sans règle
configurée, la commission reste `LEVEL_COMMISSION` (barème `parameter_versions`, comportement
2019-Phase-10 inchangé) ; avec une règle, elle devient `GENERATION` (ledger
`GENERATION_COMMISSION`, déjà ajouté à l'enum en Phase 1) — permet de distinguer plus tard, en
base, ce qui a été payé sous l'ancien système de ce qui l'a été sous le nouveau. La même
`dedupeKey` (`levelCommissionDedupeKey`) sert aux deux chemins : au plus une commission par
(bénéficiaire, niveau, génération), quel que soit celui qui la déclenche.

**Simplification assumée, pas un oubli silencieux** : pas de « rattrapage » pour le BV — un
ascendant qui débloque un niveau après coup ne récupère pas rétroactivement le BV déjà généré par
ses descendants avant ce moment (contrairement au rattrapage historique, qui lui fonctionne bien
pour le simple effectif). Le BV ne s'accumule qu'à partir du moment où la ligne
`generation_progress` existe déjà. À reconsidérer si le besoin métier l'exige — noté ici plutôt que
deviné.

**Admin** (`/admin/commission-rules`, section étendue) : une règle par (niveau, génération), même
non-rétroactivité que les règles de vente directe. Le formulaire limite volontairement le type à
`FIXED`/`BV_PERCENTAGE` et exige au moins une condition (présence ou BV minimum) — jamais une règle
qui ne gate rien du tout.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 18 assertions, chaîne réelle à 4
générations construite sous le compte racine réel (jamais modifié) —
`RacineRéelle → A1 → A2 → A3 → Vendeur`. Sans règle configurée (A1, génération 3), le comportement
historique tient exactement : `taux courant (parameter_versions) × 8`, type `LEVEL_COMMISSION`.
Avec une règle BV seule (A3, niveau 3/génération 1, présence non exigée), qualification dès que le
BV franchit le seuil, sans aucun effectif réel. Avec une règle combinée (A2, génération 2,
effectif déjà atteint mais BV insuffisant), aucune commission tant que le BV n'a pas franchi son
seuil, puis paiement exact à la 2ᵉ vente. Le BV continue de s'accumuler après complétion (traçabilité)
sans jamais payer deux fois. Une même vente crédite simultanément deux lignes de niveaux différents
(2 et 3) à la même génération relative.

## Remboursements (Phase 11, suite)

`services/sales/refund-sale.ts` — obligatoire (section 22 du prompt directeur), un système de
reversal, jamais une suppression. Une seule transaction, trois effets :

1. `sales.status → REFUNDED`, sous garde atomique (`WHERE status = 'CONFIRMED'`) — rembourser deux
   fois la même vente est explicitement rejeté, pas silencieusement ignoré.
2. **`refunds.accessRevoked` est une vraie décision respectée, pas juste un champ journalisé** :
   `hasCourseAccess`/`listCoursesForUser` acceptent désormais une vente `REFUNDED` comme donnant
   toujours accès *si* sa ligne `refunds` a `accessRevoked = false` — un administrateur peut
   rembourser l'argent tout en laissant la formation en geste commercial, sans que ce soit un simple
   log ignoré par le reste du système.
3. Si un ambassadeur avait été attribué et payé une commission `DIRECT_SALE` : reversal exact — une
   ligne `financial_transactions` négative de type `COMMISSION_REVERSAL`, liée à l'événement
   d'origine via `commissionEventId`, jamais une réécriture de la ligne existante. Correspondance
   1:1 propre (une vente ne peut produire qu'une seule commission directe), donc toujours sûr à
   annuler intégralement.

**`propagateSaleVolume` devient bidirectionnelle** — le seul changement à du code déjà écrit en
Phase 11 : la garde `bvAmount <= 0` (qui ignorait un appel accidentel) est remplacée par
`bvAmount === 0`, permettant à `refundSale` de rappeler exactement la même fonction avec un montant
négatif pour retrancher le BV remboursé de la chaîne d'ascendants. `incrementGenerationBv` ignore
déjà toute génération non `PENDING` — un décrément sur une génération déjà `COMPLETED` ajuste son
`bv_total` sans jamais la repasser à `PENDING`.

**Limite assumée, documentée plutôt que dissimulée** : le remboursement ne dé-complète jamais une
génération déjà complétée, et ne reverse jamais une commission `GENERATION` déjà versée — seule la
commission `DIRECT_SALE` (liée 1:1 à la vente) l'est. Une commission de génération dépend du BV
cumulé de potentiellement plusieurs ventes ; annuler l'intégralité de cette commission parce qu'une
seule des ventes contributrices est remboursée serait probablement incorrect (la génération peut
rester légitimement qualifiée grâce aux autres ventes) — reconstruire une logique de
« déqualification partielle » correcte est hors du périmètre de cette phase, à reconsidérer si le
besoin métier se précise.

**Admin** (`/admin/sales`, nouveau — aucune vue des ventes n'existait avant cette phase) :
`repositories/sales.ts` liste chaque vente avec acheteur/formation/ambassadeur, bouton
« Rembourser » (motif optionnel, case à cocher pour la révocation d'accès) sur toute vente encore
`CONFIRMED`.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 22 assertions — commission directe
intégralement reversée (solde revenu à zéro), BV retranché de la génération d'un ascendant réel
(chaîne à 2 niveaux sous le compte racine réel, jamais modifié) sans jamais repasser sa génération
déjà complétée à `PENDING` ni reverser sa commission de génération, accès révoqué après remboursement
avec `accessRevoked = true`, accès conservé avec `accessRevoked = false`, un deuxième remboursement
de la même vente rejeté, et un remboursement sans ambassadeur attribué qui ne touche à aucune
mécanique de commission. **Piège de script, pas de code applicatif** : les cours de test utilisaient
d'abord `levelCodes: []` (cours public par défaut, accessible à tout le monde indépendamment de
l'achat — piège déjà documenté en Phase 3) — corrigé en `levelCodes: [3]` pour que l'accès dépende
réellement de la vente testée.

## Bascule : dashboards client/ambassadeur séparés (Phase 11, suite)

Jusqu'ici, tout le pivot (Phases 1-6) a été construit service-first : `joinAmbassadorProgram`,
l'attribution, les règles BV, les remboursements existaient et étaient vérifiés en base réelle,
mais sans interface pour la plupart. Cette phase expose enfin tout ça — c'est la phase 7 du plan
validé avec l'utilisateur.

**`dashboard/layout.tsx` calcule `isAmbassador` une fois** (existence d'une ligne
`ambassador_profiles`) et le redescend à `DashboardSidebar`, qui filtre `DASHBOARD_NAV_ITEMS` par
un nouveau champ `ambassadorOnly` — réseau, commissions, transferts, niveaux et récompenses
disparaissent de la navigation d'un simple client (section 23 du prompt directeur : jamais
d'arbre MLM, de commissions, de générations, de niveau ou de solde ambassadeur pour un client).
`findDashboardSectionLabel` continue de résoudre tous les chemins sans exception — seul le rendu
de la barre latérale filtre, pas la table de routes elle-même.

**`showNav` n'est plus `status === "ACTIVE"`** : c'était un vestige de l'ancien modèle où un compte
`PENDING_PAYMENT` n'avait rien à faire sur le tableau de bord. Sous le nouveau modèle, un simple
client (jamais actif au sens de l'ancien flux) doit voir « Cours » et « Mes achats » — remplacé par
`status !== "SUSPENDED"`, même garde-fou que les pages de cours depuis la Phase 3.

**`dashboard/page.tsx` bifurque sur l'existence d'`ambassador_profiles`**, pas sur le statut : sans
ligne, vue client (cours accessibles, mes achats, carte « Devenir ambassadeur ») ; avec, la vue
ambassadeur existante (solde, niveau, cours, récompenses) inchangée. **L'ancien mur « Finalisez
votre inscription » disparaît de l'accueil par défaut** — `PayRegistrationButton`/
`payRegistrationAction` restent intacts et fonctionnels (Moneroo, `activateRegistration`), juste
plus référencés depuis cette page ; les supprimer est réservé à la Phase 8, après validation
explicite, pas une simple conséquence de ce nettoyage de vue.

**Nouveau** : `/dashboard/become-ambassador` (formulaire pseudo de parrain optionnel + case CGU,
appelle `joinAmbassadorProgram` pour de vrai) ; `/dashboard/purchases` (« Mes achats »,
`repositories/sales.ts` → `listPurchasesForBuyer`, disponible à tout le monde) ; section « Mes
ventes » ajoutée à `/dashboard/commissions` (`listSalesForAmbassador`, distincte du grand livre des
commissions — montre les ventes à l'origine des gains, pas seulement les montants) ; le BV
s'affiche désormais à côté de l'effectif sur `/dashboard/levels`, `generation_progress.bvTotal`
n'étant plus une donnée purement interne depuis la Phase 5. **Bug trouvé au passage** : les
libellés du grand livre (`TYPE_LABEL` sur `/dashboard/commissions`) n'avaient jamais été mis à jour
pour `DIRECT_SALE_COMMISSION`/`GENERATION_COMMISSION`/`COMMISSION_REVERSAL` depuis leur ajout aux
Phases 1/4/5/6 — ces lignes s'affichaient avec le nom brut de l'enum ; corrigé.

**Ce qui reste explicitement non construit** (sections 23/24 du prompt directeur, à ne pas confondre
avec un oubli) : certificats, factures, notifications, retraits — aucune de ces fonctionnalités
n'existe ailleurs dans le projet, aucune n'a été inventée ici pour « compléter » la liste.

**Limite de vérification assumée** : les changements de cette phase touchent uniquement le rendu
selon l'état d'authentification (vue client vs ambassadeur) — sans clé `service_role` Supabase ni
identifiants de test réels (contrainte déjà documentée dans `TESTING.md` pour les tests e2e
d'inscription), impossible de piloter un navigateur connecté pour comparer visuellement les deux
vues. Vérifié à la place par : `build`/`typecheck` (chaque page passe la vérification de types
bout en bout, y compris le flux de données serveur → composant), un smoke-test du serveur de
développement sur toutes les routes nouvelles/modifiées (aucun crash, redirections correctes pour
un visiteur non connecté), et un script temporaire (9 assertions, nettoyé) vérifiant en base réelle
que `listPurchasesForBuyer`/`listSalesForAmbassador` — les deux nouvelles requêtes dont ces pages
dépendent — renvoient les bonnes données. La correction du *rendu visuel* proprement dit n'a pas pu
être confirmée à l'œil.

## Retrait des points d'entrée de l'ancien système (Phase 11, fin)

Dernière phase du plan validé avec l'utilisateur — « uniquement après validation explicite,
jamais automatique » (voir l'audit initial). Ce qui a été retiré, et surtout ce qui ne l'a **pas**
été :

**Retiré — plus aucun moyen de créer un nouveau paiement `REGISTRATION`** : `PayRegistrationButton`
(`dashboard/pay-registration-button.tsx`, déjà orpheline depuis la Phase 7) et `payRegistrationAction`
supprimés ; `GrantCreditButton` (`admin/members/[userId]/grant-credit-button.tsx`) et
`grantAdminCreditAction` supprimés. Ce deuxième retrait n'est pas qu'un nettoyage d'interface : le
bouton « Créditer » restait la **seule voie encore active** vers `activateRegistration`, qui verse
une commission `DIRECT` à l'inscription — exactement la règle que le pivot a explicitement
abandonnée (section 11 : la commission directe vient désormais d'une vente, jamais du recrutement).
Le retirer ferme une vraie boucle, pas seulement un bouton inutile.

**Conservé, intentionnellement** : `services/payments/activate-registration.ts`,
`initiate-registration-payment.ts`, `admin-credit.ts`, `wallet-payment.ts`
(`payRegistrationFromWallet` — déjà sans appelant avant même cette phase, jamais branché à une
UI) et la branche `REGISTRATION` du dispatch webhook (`process-webhook-event.ts`, inchangée)
restent tous en place. Aucune UI ne peut plus créer de nouveau paiement `purpose = REGISTRATION`
après cette phase, mais un paiement déjà `PENDING` avant le déploiement doit encore pouvoir se
confirmer normalement — supprimer le dispatch aurait cassé cette confirmation en silence, un
risque bien pire que de garder quelques lignes de code inertes. Toutes les données historiques
(`payments`, `financial_transactions`, `commission_events` liées à `REGISTRATION`/`DIRECT`)
restent intactes et interrogeables, conformément à la règle absolue de ce projet : jamais de
suppression rétroactive.

**Bug réel trouvé en écrivant la vérification, pas en production** : `setMemberStatus` bloquait
depuis toujours la suspension d'un compte `PENDING_PAYMENT` (« rien à suspendre » — un garde-fou
de l'ancien modèle où ce statut signifiait « n'existe pas encore vraiment »). Sous le
nouveau modèle, `PENDING_PAYMENT` est un état client normal et durable — corrigé pour l'autoriser.
Mais la réactivation posait un second piège, découvert par le premier jet du script de
vérification : `setMemberStatus` refixait `ACTIVE` sans condition, ce qui aurait promu un simple
client réactivé au rang d'ambassadeur. Première correction (vérifier `ambassador_profiles`) encore
fausse — testée avec la mauvaise variable (`target.status`, qui vaut toujours `SUSPENDED` au
moment de la réactivation, jamais utile pour ce test). Signal final correct : l'existence d'une
ligne `binary_nodes`, pas `ambassador_profiles` — un membre activé par l'ancien flux payant a une
position dans l'arbre sans jamais avoir de ligne `ambassador_profiles`, donc vérifier cette
dernière aurait à tort rétrogradé un membre légitimement actif avant le pivot.

**Relabelling, pas de renommage d'enum** : `PENDING_PAYMENT` s'affichait « En attente de paiement »
dans l'admin — trompeur maintenant que ce statut signifie surtout « n'a pas rejoint le programme
ambassadeur », pas « n'a pas payé ». Renommé en affichage seulement (« Client (non-ambassadeur) »)
sur `admin/members/page.tsx` et `admin/members/[userId]/page.tsx` — la valeur d'enum elle-même
reste `PENDING_PAYMENT` en base, un renommage de schéma étant une décision séparée, plus lourde,
non demandée ici.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 11 assertions — un client
`PENDING_PAYMENT` suspendu puis réactivé retombe bien sur `PENDING_PAYMENT` (jamais promu
`ACTIVE`), avec l'entrée d'audit reflétant le vrai statut appliqué ; un ambassadeur réel (placé via
`joinAmbassadorProgram` sous le compte racine réel, jamais modifié) suspendu puis réactivé retombe
sur `ACTIVE` ; un membre simulant l'ancien flux payant (position réelle dans l'arbre, ligne
`ambassador_profiles` explicitement absente) suspendu puis réactivé reste bien `ACTIVE` — exactement
le cas que la première version de la correction aurait cassé ; auto-modification toujours bloquée.

## Mode clair/sombre + refonte du habillage (post-Phase 11)

À la demande de l'utilisateur (inspiration : un dashboard SaaS de référence), adapté à la marque
existante plutôt que copié tel quel :

- **`next-themes`** ajouté, `ThemeProvider` dans `app/layout.tsx` (`suppressHydrationWarning`
  requis), bouton de bascule (`components/theme-toggle.tsx`) dans les deux barres du haut
  (dashboard et admin) — les deux icônes sont toujours rendues, seul le CSS (`dark:`) décide
  laquelle s'affiche, pour éviter le classique piège `useState`+`useEffect` de « montage » que la
  règle ESLint `react-hooks/set-state-in-effect` de ce projet rejette.
- **Les tokens de couleur shadcn étaient en gris neutre pur** (`oklch(... 0 0)`) — le bleu de
  marque n'existait qu'en classes Tailwind littérales (`bg-blue-600`) éparpillées dans le code,
  invisibles au système de thème. Basculé sur un vrai bleu en tokens (`--primary`,
  `--sidebar-primary`, etc.), en clair et en sombre — `bg-primary`/`text-primary` reflètent
  désormais la marque automatiquement partout, y compris dans les composants shadcn déjà
  token-based (`Card`) sans avoir eu besoin d'y toucher un par un.
- **Bandeau bleu plein fixe retiré des deux topbars** (dashboard, admin) — aurait juré sur fond
  sombre. Remplacé par une barre neutre et adaptative (`bg-card`/`border-border`), l'énergie de
  couleur reportée sur les cartes (ex. la carte « Devenir ambassadeur » du dashboard, dégradé
  `from-primary to-primary/70`).
- Sidebar, cadre du layout (dashboard et admin) et `StatCard` retouchés de la même façon —
  littéraux `bg-white`/`text-slate-*`/`hover:bg-slate-50` remplacés par les tokens
  `bg-sidebar`/`text-sidebar-foreground`/`hover:bg-accent` correspondants.

**Vérification** : `build`/`typecheck`/`lint` propres, et confirmation directe dans le CSS compilé
servi par le serveur de dev que le nouveau bleu (`#2263eb` en clair) et le script d'injection de
thème sont bien présents. Pas de vérification visuelle du rendu authentifié — même limite déjà
documentée ailleurs (pas d'identifiants de test).

## Achat obligatoire pour tous — retrait de l'accès par niveau (post-Phase 11)

La 4ᵉ décision validée avant le pivot (« achat obligatoire pour tous ») restait délibérément
non exécutée depuis la Phase 3 — `hasCourseAccess` avait un chemin d'accès par niveau **additif**,
jamais retiré faute de validation explicite (voir la section Phase 3 plus haut). Confirmée
explicitement par l'utilisateur : « il n'y a plus de cours débloqué par niveau, tous les cours
sont publics en vente ».

**Retiré** : le chemin `course_levels`/`member_levels` dans `hasCourseAccess` et
`listCoursesForUser` (`repositories/courses.ts`) — l'accès ne dépend plus que d'une vente
confirmée (ou conservée après remboursement) ou du rôle admin. Le sélecteur de niveaux requis a
disparu du formulaire de création de cours (`new-course-form.tsx`) ; `createCourse` n'accepte
plus `levelCodes` du tout (signature changée, pas juste un champ ignoré) ; `listAllCoursesForAdmin`
ne calcule plus les niveaux associés. La page « Mes cours » (`dashboard/courses/page.tsx`) rend
désormais chaque cours cliquable, même non acheté — il mène à la page de détail, qui affiche déjà
le bouton d'achat depuis la Phase 3.

**Conservé, comme pour l'ancien système d'inscription** : la table `course_levels` elle-même
reste en base, simplement plus jamais lue ni écrite — aucune migration de suppression de structure
n'a été faite, cette décision porte sur le comportement d'accès, pas sur le schéma.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 4 assertions — un membre avec
`course_levels`/`member_levels` simulant exactement l'ancien scénario « niveau atteint » n'a
**plus** accès (avant cette phase, il l'aurait eu) ; le même constat sur `listCoursesForUser` ;
l'achat continue de donner accès normalement (chemin inchangé, non régressé) ; l'admin garde son
accès inconditionnel.

## Police Poppins + correction d'un bug de police pré-existant

À la demande de l'utilisateur, `Geist` (police du scaffold `create-next-app`, jamais choisie
intentionnellement) remplacée par `Poppins` (`next/font/google`, poids 300 à 700 — Poppins n'est
pas une police à axe variable sur Google Fonts, contrairement à Geist, d'où la liste de poids
explicite au lieu d'un seul objet variable).

**Bug pré-existant trouvé au passage, pas introduit par ce changement** : `globals.css` définissait
`--font-sans: var(--font-sans)` — une référence circulaire sur elle-même, jamais branchée sur
`--font-geist-sans`. Le texte du site n'a donc **jamais** réellement utilisé Geist depuis le
scaffold initial : il retombait silencieusement sur la pile sans-serif par défaut de Tailwind,
sans erreur visible (juste une police système générique, assez proche visuellement pour passer
inaperçue). Corrigé en même temps : `--font-sans: var(--font-poppins)`.

## Tableau de bord ambassadeur enrichi + page Paramètres

À la demande de l'utilisateur (« ajouter plus de détails utiles tels que les ventes récentes,
le graph d'évolution... » puis, dans la foulée, « cache ces éléments [email/rôle/statut] dans
un onglet paramètre... avec la possibilité de les modifier avec le mot de passe et autre »).

**Solde — évolution 30 jours** : `getBalanceHistory` (nouveau, `repositories/financial-transactions.ts`)
reconstruit une série d'un point par jour à partir du grand livre `financial_transactions` — jamais
de `user_balances` (qui n'est qu'un cache) — en sommant les montants dans l'ordre chronologique et
en reportant la dernière valeur connue sur les jours sans transaction. Rendu par
`BalanceEvolutionChart` (`components/balance-evolution-chart.tsx`, `"use client"`), un graphique
en aire/ligne SVG écrit à la main en suivant le skill dataviz : une seule série donc pas de légende,
trait 2px, aire en dégradé à ~15 % d'opacité de `--color-primary`, point final étiqueté directement,
survol avec ligne de repère + infobulle. Aucune nouvelle dépendance de graphique ajoutée. État vide
explicite (« Aucune activité... ») si le solde est resté à 0 sur toute la fenêtre plutôt qu'une ligne
plate sans information.

**Vérifié en conditions réelles** (scripts temporaires, nettoyés) : lecture seule sur un profil réel
(30 points, dates strictement croissantes, dernier jour = aujourd'hui, dernier point == solde en
cache) ; puis, sur `financial_transactions` uniquement (jamais `user_balances`, donc sans toucher au
solde réel de qui que ce soit), insertion de 4 transactions synthétiques à des dates connues,
confirmation exacte des valeurs cumulées attendues à chaque jour clé (report avant fenêtre, changement
de valeur, report après changement), puis suppression des 4 lignes.

**Ventes/achats récents** : liste des 5 dernières ventes attribuées (`listSalesForAmbassador`,
déjà utilisée par la page Commissions) pour un ambassadeur, ou des 5 derniers achats
(`listPurchasesForBuyer`) pour un client — avec lien « Voir tout » vers la page complète existante
au-delà de 5. Nouvelle carte statistique « BV total (équipe) » (somme des `bvTotal` de toutes les
générations de `listLevelProgress`, déjà chargée pour la carte Niveau).

**Page Paramètres** (`dashboard/settings/`, nouvelle entrée de nav « Paramètres ») : le résumé
email/rôle/statut, jusque-là affiché en lecture seule sur l'accueil, en a été retiré et vit
maintenant ici, avec deux formulaires :
- **Profil** — nom complet, pseudo, téléphone, pays, via un nouveau
  `services/profile/update-profile.ts` + `repositories/profiles.ts#updateProfileFields`. Le
  rôle et le statut restent strictement lecture seule (gérés uniquement côté admin,
  `services/admin/set-member-status.ts`) — jamais exposés en écriture ici. Unicité du pseudo
  revérifiée côté service (`usernameSchema` extrait de `schemas/auth.ts` pour être partagé).
- **Mot de passe** — réutilise tel quel `services/auth/update-password.ts` (déjà utilisé par le
  flux de réinitialisation par email) via une nouvelle action qui ne redirige pas vers `/login`
  (contrairement à `resetPasswordAction`) puisque la session reste active. Pas de vérification de
  l'ancien mot de passe : la session déjà authentifiée porte la même confiance que le lien de
  récupération, qui ne la demande pas non plus.

**Vérification** : `typecheck`/`lint`/`test` (72 passants)/`build` propres ; routes `/dashboard`
et `/dashboard/settings` confirmées servies (redirection 307 vers `/login` en anonyme, comportement
attendu de `requireUser`). Le changement de mot de passe réel n'a volontairement pas été testé en
conditions réelles contre un compte existant (risque d'altérer des identifiants de connexion réels) —
la fonction sous-jacente était déjà éprouvée par le flux de réinitialisation.

## Carte « Commissions directes » (post-Phase 11)

À la demande de l'utilisateur : une zone dédiée aux commissions directes/individuelles issues des
ventes personnelles, distincte de « BV total (équipe) » qui reste un indicateur d'équipe.

`getDirectSaleCommissionTotal` (nouveau, `repositories/financial-transactions.ts`) calcule le total
**net** — pas seulement la somme brute des `DIRECT_SALE_COMMISSION` — en jointant les lignes
`COMMISSION_REVERSAL` du grand livre à `commission_events` via `commissionEventId` pour ne compter
que celles qui annulent effectivement un événement de type `DIRECT_SALE` (une vente personnelle
remboursée doit faire redescendre ce chiffre, comme elle fait déjà redescendre le solde disponible
via `creditBalance` — sans ce filtrage, le chiffre affiché aurait pu rester supérieur à la réalité
après un remboursement). Le type `GENERATION_COMMISSION` (bonus d'équipe) et ses propres reversals
sont exclus par construction. Rendu comme 6ᵉ carte statistique du tableau de bord ambassadeur,
juste après « Solde disponible ».

**Vérifié en conditions réelles** (script temporaire, nettoyé, sur le même profil de test isolé
qu'utilisé précédemment) : 3 `commission_events`/5 lignes de grand livre synthétiques — une
commission directe intégralement remboursée (doit s'annuler à 0), une commission directe jamais
remboursée (doit compter en entier), une commission de génération avec son propre reversal (doit
être totalement exclue) — total obtenu : 500, exactement la valeur attendue.

## Affichage mobile du dashboard et de l'admin (post-Phase 11)

Bug signalé par l'utilisateur (capture d'écran) : sur mobile, la sidebar (`w-60` fixe, toujours
rendue comme enfant flex normal) prenait presque toute la largeur de l'écran, écrasant le contenu
dans une bande étroite (cartes statistiques déformées).

**Corrigé** : la sidebar (`dashboard-sidebar.tsx`, `admin-sidebar.tsx`) devient un tiroir hors-écran
en dessous de `lg` — `fixed -translate-x-full`, ouvert via `translate-x-0` + fond semi-transparent
cliquable pour fermer, toujours `lg:static lg:translate-x-0` (comportement desktop inchangé). L'état
ouvert/fermé est partagé entre la sidebar et le bouton hamburger de la topbar via un contexte React
minimal (`components/mobile-sidebar-context.tsx`, `MobileSidebarProvider`/`useMobileSidebar`) — les
deux vivent dans des fichiers séparés (nav différente dashboard/admin) et le layout qui les englobe
est un Server Component, d'où le contexte plutôt qu'un simple state local. Un clic sur un lien du
menu ferme automatiquement le tiroir.

Ajustements d'espacement associés : la carte flottante du shell (padding/coins arrondis) ne
s'applique plus qu'à partir de `sm` — en dessous, elle occupe tout l'écran (`p-0`/`h-screen`, pas
de `rounded-3xl`/`rounded-tr-3xl` flottant dans le vide) ; le padding horizontal du contenu
(`main`, topbar) passe de `px-8` fixe à `px-4 sm:px-8` ; sur la topbar admin (4 icônes contre 3 côté
dashboard), les raccourcis Journal d'audit/Paramètres et le nom affiché se masquent sous `sm`
(déjà atteignables via le tiroir de nav) pour ne pas revenir au même écrasement plus haut dans la
page.

**Vérification** : `typecheck`/`lint`/`test` (72 passants)/`build` propres. Comme pour les tours
d'authentification précédents de cette session, le rendu mobile réel du dashboard/admin **authentifié**
n'a pas pu être vérifié visuellement — toujours aucun identifiant de test ni clé service role
disponible pour créer un compte jetable et le nettoyer ensuite (même contrainte documentée dans
`e2e/auth.spec.ts`). Le correctif suit un pattern de tiroir hors-écran standard et éprouvé ; à
confirmer par l'utilisateur sur son propre téléphone.

## Next.js 16 — points spécifiques à ce projet

Ce projet a été scaffoldé avec Next.js 16, plus récent que la plupart des connaissances
pré-entraînées sur Next.js. Avant d'écrire du code touchant aux routes, relire
`node_modules/next/dist/docs/` (les conventions changent — voir `AGENTS.md`). Points déjà
appliqués dans ce repo :

- `middleware.ts` est renommé `proxy.ts` (`src/proxy.ts`, export nommé `proxy`, runtime Node.js
  uniquement) — utilisé ici uniquement pour rafraîchir la session Supabase, pas pour de la logique
  métier.
- `params` / `searchParams` sont toujours asynchrones (`await props.params`).
- Turbopack est le bundler par défaut (`next dev` / `next build` sans flag).
- `next lint` est supprimé — `npm run lint` appelle directement l'ESLint CLI (flat config).

## Génération de cours par IA (en cours — Phase A livrée)

À la demande de l'utilisateur : un outil admin pour générer des cours complets (métadonnées +
plan de modules/leçons) via Claude. Découpé en 4 phases validées avec l'utilisateur avant de
coder — schéma d'abord (cette section), puis progression/quiz côté apprenant, puis édition admin
(prérequis : aujourd'hui impossible de modifier une leçon après création), puis l'intégration
Claude elle-même. Décision clé issue de la discussion : certains cours seront entièrement des
leçons-texte avec quiz de compréhension bloquant, d'autres resteront vidéo — d'où le besoin
d'un `lesson_type` plutôt que de simplement traiter l'absence de vidéo comme un défaut temporaire
en attendant que l'admin l'uploade.

**Phase A (schéma)** : voir `DATABASE.md` pour le détail des tables et la vérification live.
Résumé : `lessons` gagne `lesson_type`/`content`, `video_provider`/`video_url` deviennent
optionnels ; nouvelles tables `quizzes`/`quiz_questions`/`quiz_attempts`. Rien d'autre ne change
encore — aucun service ni UI n'exploite ces colonnes pour l'instant, seul l'ajustement de
type minimal nécessaire a été fait sur la page cours apprenant (leçon sans vidéo → titre en
texte simple plutôt qu'un lien mort). Confirmé avec l'utilisateur : la clé `ANTHROPIC_API_KEY`
n'est nécessaire qu'au moment où un admin clique sur « Générer » — une fois le cours créé, il vit
entièrement en base, aucune dépendance à l'API ensuite.

**Phase B (progression + quiz côté apprenant)** : règle de verrouillage exacte, décidée avec
l'utilisateur — une leçon *avec* quiz verrouille la leçon suivante (dans l'ordre module puis
position) tant que ce quiz n'est pas réussi ; une leçon *sans* quiz ne verrouille jamais rien,
exactement le comportement d'avant cette phase. Implémenté dans `getCourseContent`
(`repositories/courses.ts`) : un seul passage sur la liste aplatie des leçons calcule `locked`/
`hasQuiz` pour chacune, réutilisé tel quel par la page de présentation du cours et par la page de
leçon (`submitQuizAttempt` revérifie ce même verrouillage côté serveur avant d'accepter une
réponse — pas seulement caché côté UI).

Une leçon TEXTE sans quiz garde le bouton « Marquer comme terminée » existant, inchangé. Une leçon
TEXTE avec quiz ne peut être terminée qu'en réussissant le quiz — `submitQuizAttempt`
(`services/lms/submit-quiz-attempt.ts`) note la tentative dans `quiz_attempts` (jamais écrasée,
un échec reste consultable) et, seulement si réussie, écrit aussi `lesson_progress` dans la même
transaction — `lesson_progress` reste ainsi l'unique signal de complétion lu partout ailleurs
(pourcentage de progression, badge « Terminée »), qu'elle vienne d'un clic ou d'un quiz réussi.
Les options de quiz ne sont jamais envoyées au client avec leur `isCorrect` — la page
(`dashboard/courses/[courseId]/lessons/[lessonId]/page.tsx`) construit une version assainie avant
de la passer au composant `QuizForm`.

Nouvelle route `/dashboard/courses/[courseId]/lessons/[lessonId]` — uniquement pour les leçons
TEXTE ; une leçon VIDÉO ou une leçon verrouillée qu'on tente d'atteindre directement par l'URL est
renvoyée vers la page de présentation du cours.

**Vérifié en conditions réelles** (script temporaire, nettoyé, sur un cours brouillon jetable,
accès via le compte admin réel qui contourne `hasCourseAccess` sans toucher à ses propres
données) : 8 assertions — verrouillage initial correct (leçon sans quiz jamais verrouillée, leçon
après un quiz verrouillée, leçon après une leçon sans quiz pas verrouillée par elle) ; soumission
refusée sur une leçon encore verrouillée ; mauvaise réponse → échec sans déverrouiller la suite ;
bonne réponse → déverrouille bien la leçon suivante ; score pile au seuil de passage (50 % avec
`passingScore=50`) accepté ; soumission de quiz sur une leçon VIDÉO refusée ; `markLessonComplete`
toujours fonctionnel sur une leçon vidéo une fois déverrouillée ; suppression en cascade complète.

**Phase C (édition admin)** : jusqu'ici, `createCourse`/`createModule`/`createLesson` n'avaient
aucun équivalent `update*` — impossible de corriger une leçon après coup, ce qui aurait bloqué
net la Phase D (une leçon vidéo générée par l'IA sans vraie vidéo doit pouvoir être complétée par
l'admin ensuite). Ajout de `updateLesson`/`updateModule`/`updateCourseStatus`/`saveQuiz`
(`services/lms/`), tous avec la même vérification de rôle + `logAdminAction` que les créations
existantes.

- `updateLesson` gère le changement de type en cours de route : passer une leçon de VIDEO à TEXT
  (ou l'inverse) vide explicitement les champs qui ne s'appliquent plus (`videoProvider`/
  `videoUrl` ↔ `content`) plutôt que de laisser une donnée obsolète traîner en base.
- `saveQuiz` remplace intégralement les questions à chaque enregistrement (suppression puis
  réinsertion) plutôt que du CRUD question par question — un admin (ou plus tard l'IA) soumet le
  quiz en entier. Sans conséquence sur l'historique : `quiz_attempts.answers` est un instantané
  pris au moment de la tentative, jamais une référence vivante vers les lignes de questions.
  Validation appliquée à l'enregistrement : chaque question a au moins 2 options et exactement une
  bonne réponse ; seuil de réussite entre 1 et 100 ; refusé sur une leçon qui n'est pas de type
  TEXTE.
- `updateCourseStatus` — le bouton « Publier »/« Repasser en brouillon » sur la page admin d'un
  cours. Nécessaire pour la Phase D : un cours généré par IA doit arriver en brouillon, invisible
  des apprenants, tant que l'admin ne l'a pas relu et publié explicitement.
- `createLesson`/`add-lesson-form.tsx` acceptent maintenant aussi le type TEXTE à la création (pas
  seulement à l'édition), pour rester cohérents.
- Nouvelle route admin `/admin/courses/[courseId]/lessons/[lessonId]` — formulaire d'édition de
  leçon, plus un éditeur de quiz (ajout/suppression de questions et d'options, réponse correcte
  via un radio par question) affiché uniquement pour une leçon TEXTE.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : 9 assertions — publication d'un
cours brouillon ; renommage + désactivation d'un module ; bascule VIDEO→TEXT (vidéo effacée,
contenu posé) puis TEXT→VIDEO (contenu effacé, nouvelle vidéo posée) ; premier enregistrement de
quiz (2 questions, chacune exactement 1 bonne réponse) ; second enregistrement qui remplace
entièrement le premier (1 question différente, nouveau seuil) ; rejet d'une question sans bonne
réponse, d'une question à 2 bonnes réponses, et d'un seuil hors [1,100] ; rejet d'un quiz sur une
leçon vidéo ; suppression en cascade complète.

**Phase D (génération par Claude)** — dépendance ajoutée : `@anthropic-ai/sdk`. Clé
`ANTHROPIC_API_KEY` lue paresseusement (`config/env.anthropic.ts`, même raisonnement que
`env.moneroo.ts` — un build/boot de l'app ne doit jamais dépendre d'un fournisseur externe
configuré) ; toujours un placeholder dans cet environnement (`sk-ant-placeholder_not_a_real_key`),
à remplacer par l'utilisateur.

`services/lms/generate-course-with-ai.ts` est volontairement coupé en deux fonctions
indépendantes :
- `callClaudeForCourseOutline` — le seul point qui touche le réseau. Le plan demandé à Claude
  passe par un *tool call* forcé (`tool_choice: {type: "tool", ...}`), pas un prompt « réponds en
  JSON » — la réponse est structurellement garantie de matcher le schéma envoyé, puis revalidée
  côté serveur avec Zod avant d'être crue (défense en profondeur contre une réponse malformée).
  Modèle : Sonnet, pas Opus — un plan de cours (texte structuré + prose d'article) reste dans la
  catégorie « bon compromis par défaut », pas un besoin de raisonnement de niveau Opus.
- `persistGeneratedCourse` — prend un objet `GeneratedCourse` déjà validé et écrit
  cours/modules/leçons(/quiz/questions) en une transaction, exactement comme un admin qui
  saisirait tout à la main. Ne fait aucun appel réseau — c'est ce qui a permis de la vérifier
  intégralement sans clé API réelle (voir plus bas).

Toujours un cours en **DRAFT** (jamais publié automatiquement — le bouton « Publier » de la
Phase C est la porte de sortie). Une leçon VIDEO générée n'a ni `videoUrl` ni `content` — l'admin
l'ajoute ensuite via la page de leçon de la Phase C, exactement le prérequis qui a motivé cette
phase. Une leçon TEXT reçoit son article complet et, si demandé, son quiz (`quiz`/`quiz_questions`
insérés dans la même transaction). Nouvelle page admin `/admin/courses/generate` (sujet, niveau
optionnel, nombre de modules, type de contenu VIDEO/TEXTE/mixte) — accessible depuis
`/admin/courses` à côté de « Nouveau cours ».

**Confirmé avec l'utilisateur** : une fois un cours généré, il vit entièrement en base — la clé
Anthropic n'est nécessaire qu'au moment de l'appel « Générer », jamais pour qu'un apprenant
consulte un cours déjà créé.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : `persistGeneratedCourse` testée
avec un plan entièrement fabriqué à la main (aucun appel à Claude) — cours créé en DRAFT ; 2
modules et 3 leçons persistés ; la leçon TEXT reçoit son contenu et son quiz (seuil + nombre de
questions corrects) sans vidéo ; la leçon VIDEO reçoit ni vidéo ni contenu (prête pour un upload
admin) ; une leçon sans quiz n'en a effectivement aucun ; suppression en cascade complète. Séparément,
`callClaudeForCourseOutline` appelée pour de vrai avec la clé placeholder actuelle : échoue
proprement avec une erreur 401 « API key is invalid » interceptable, pas un crash — confirme que le
chemin d'erreur fonctionne, mais la qualité réelle du contenu généré par Claude reste **non
vérifiable** sans une vraie clé.

## Argent

Tout montant est un entier F CFA (XOF n'a pas de sous-unité). Jamais de flottant. Voir
`FINANCIAL_MODEL.md` (ajouté en Phase 4) pour les règles de calcul et de non-rétroactivité des
paramètres versionnés.

## Miniatures de formation (post-Phase 11, hors plan initial)

`courses.thumbnailUrl` existait déjà dans le schéma (posé lors du pivot formation) et était déjà
lu par `CourseCard` (page d'accueil) — il manquait la capacité de le renseigner. Contrairement aux
vidéos de leçon (hébergées en externe, YouTube/Vimeo, décision explicite d'éviter un nouveau
vendeur payant), les miniatures sont réellement uploadées via **Supabase Storage** : ce n'est pas
un nouveau vendeur, juste le service Storage du même projet Supabase déjà utilisé pour
Postgres/Auth.

**Bucket public `course-thumbnails`** (migration 0030, SQL brut — `storage.buckets`/
`storage.objects` ne font pas partie du schéma Drizzle, même traitement que `auth.users` dans
`repositories/auth-users.ts`) : lecture publique (les cartes de formation doivent s'afficher pour
un visiteur non connecté), écriture restreinte aux admins via une policy RLS sur
`storage.objects` (`EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ADMIN')`).
Cette policy est **la seule policy RLS réellement porteuse de ce projet** — partout ailleurs, RLS
n'est que défense en profondeur puisque l'app écrit via Drizzle sur une connexion Postgres directe
qui contourne RLS (voir `SECURITY.md`) ; ici, l'upload passe par le client Supabase authentifié à
la session (`lib/supabase/server.ts`, cookies), pas par Drizzle, car un objet Storage est un
fichier, pas une ligne Postgres atteignable par la connexion directe.

**`services/lms/upload-course-thumbnail.ts`** — vérifie d'abord le type (JPEG/PNG/WebP
uniquement ; SVG explicitement exclu, un SVG pouvant embarquer du script, contrairement aux
formats raster jamais exécutés par un navigateur) et la taille (5 Mo max), puis le rôle admin
**en code applicatif d'abord** (même discipline que tous les autres services admin) avant même de
toucher au client Supabase — la policy RLS n'est donc jamais l'unique garde-fou. Upload sous
`{courseId}/{uuid}.{ext}`, URL publique récupérée via `getPublicUrl`, écrite dans
`courses.thumbnailUrl` par une simple `UPDATE` Drizzle. Pas de suppression de l'ancienne image au
remplacement (limite assumée — un peu de stockage orphelin plutôt qu'une suppression risquée si
jamais deux miniatures pointaient vers le même chemin).

Interface : `/admin/courses/[courseId]` (bouton d'upload avec aperçu, `EditThumbnailForm`) et un
aperçu miniature ajouté à la liste `/admin/courses`.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : bucket et les 4 policies confirmés
existants en base après migration ; 4 assertions sur les garde-fous purs de
`uploadCourseThumbnail` (format non supporté, taille > 5 Mo, appelant non-admin, formation
introuvable) — tous rejetés avant tout appel réseau. **Limite de vérification assumée** : l'envoi
réel vers Supabase Storage passe par `createClient()` (`next/headers`'s `cookies()`), qui exige un
vrai contexte de requête Next.js authentifié — impossible à simuler depuis un script autonome sans
mot de passe admin réel ni clé service-role (délibérément non ajoutée à ce projet pour cette
fonctionnalité). Le chemin réseau lui-même reste donc à confirmer dans le navigateur, même
limitation que `callClaudeForCourseOutline` avant l'arrivée d'une vraie clé Anthropic.

## Achat de formation par wallet (post-Phase 11, hors plan initial)

Jusqu'ici, `initiateCoursePurchase` ne créait que des paiements `MOBILE_MONEY` — aucun chemin ne
débitait le solde disponible d'un membre pour un achat de formation (contrairement à l'inscription,
qui avait déjà `payRegistrationFromWallet`). Décision produit explicite : un acheteur peut désigner
**n'importe quel wallet par pseudo** — le sien ou celui d'un autre membre — sans restriction de
parrainage (contrairement à `payRegistrationFromWallet`, qui n'autorisait qu'un parrain à financer
son propre filleul). Cette absence de restriction impose une vraie question de sécurité : sans
garde-fou, un acheteur pourrait vider le solde de n'importe qui en tapant simplement son pseudo.

**Le code OTP part vers le propriétaire du wallet, jamais vers l'acheteur** — même principe que
`initiateTransfer`/`confirmTransfer` (la personne dont le solde est en jeu doit l'autoriser), étendu
ici au cas où payeur et acheteur sont deux personnes différentes. Quand les deux coïncident (payer
avec son propre solde), le code arrive simplement dans sa propre boîte mail — aucun cas particulier
dans le code d'envoi.

**Nouvelle table `course_purchase_wallet_requests`** (migration 0033) — même forme que
`wallet_transfers` (`otpCodeHash`/`otpExpiresAt`/`otpAttempts`, `PENDING_OTP → CONFIRMED/EXPIRED`),
avec en plus `ambassadorUserId`/`attributionId` capturés à la demande (`resolveAttribution`, le seul
moment où un contexte de requête avec cookies existe encore) et reportés dans `payments.metadata` à
la confirmation — exactement le même découpage que `initiateCoursePurchase`/`confirmCoursePurchase`
pour Mobile Money.

**`services/sales/confirm-course-purchase-wallet.ts` ne réimplémente rien de la vente elle-même** —
il gère uniquement l'OTP et le débit du solde (`UPDATE ... WHERE available_balance >= amount`, même
verrou atomique que `confirmTransfer`/`confirm-course-purchase.ts`), crée une ligne `payments`
(`method: WALLET`, `payerUserId` = propriétaire du wallet, `beneficiaryUserId` = acheteur), puis
délègue à **la vraie `confirmCoursePurchase`** — la même fonction déjà appelée par le webhook
Moneroo — pour la ligne `sales`, la commission d'ambassadeur et la propagation du BV. Aucune
duplication de cette logique.

Interface : `/dashboard/courses/[courseId]` propose désormais un sélecteur Mobile Money / Solde
(`PurchasePanel`) au-dessus du bouton d'achat existant ; le champ pseudo est pré-rempli avec le
pseudo de l'acheteur (cas le plus courant : payer avec son propre solde) mais reste modifiable.

**Vérifié en conditions réelles** (script temporaire, nettoyé, solde de test entièrement retiré
après coup) : 14 assertions — pseudo de wallet inconnu rejeté, solde insuffisant rejeté, ligne
`PENDING_OTP` bien créée malgré l'échec d'envoi d'email (clé Resend placeholder, même limitation que
les retraits), confirmation par un tiers non concerné (ni acheteur ni propriétaire du wallet)
rejetée, mauvais code rejeté, cycle complet réussi avec réutilisation réelle de
`confirmCoursePurchase` (ligne `sales` réelle créée, `payments.method = WALLET`, solde débité du
montant exact), reconfirmation et achat en double tous deux rejetés. **Limite de vérification
assumée** : un seul membre réel existe en base à ce jour (l'administrateur) — le scénario « payer
depuis le solde d'un *autre* membre » a donc été vérifié par relecture du code (chemin strictement
identique, `walletUserId` résout juste vers un profil différent) plutôt que de bout en bout avec deux
personnes distinctes, faute d'un second compte réel disponible.
