# Base de données

PostgreSQL (Supabase), schéma géré par Drizzle ORM (`src/db/schema/`), migrations dans
`src/db/migrations/`.

## État actuel

- `0000_enable_extensions.sql` — active `ltree` (nécessaire à `binary_nodes`, voir
  `ARCHITECTURE.md`).
- `0001_flawless_blazing_skull.sql` — table `profiles` (1:1 avec `auth.users`, géré par Supabase
  Auth — le `CREATE TABLE "auth"."users"` généré par drizzle-kit a été retiré à la main, cette
  table existe déjà). Enums `profile_role` (USER/ADMIN) et `profile_status`
  (PENDING_PAYMENT/ACTIVE/SUSPENDED).
- `0002_profiles_rls.sql` — active RLS sur `profiles` (défense en profondeur ; l'accès applicatif
  passe par Drizzle en connexion directe, qui contourne RLS par construction — voir
  `ARCHITECTURE.md`).
- `0003_mixed_silhouette.sql` — tables `sponsorships` et `binary_nodes` (voir schéma cible
  ci-dessous). Enums `binary_position` (LEFT/RIGHT) et `placement_method`
  (AUTO_GREEDY/MANUAL/ADMIN_OVERRIDE).
- `0004_genealogy_rls_and_gist.sql` — index GiST sur `binary_nodes.path` (nécessaire aux
  opérateurs `<@`/`@>`, un index btree ne suffit pas) + RLS sur les deux tables.
- `0005_narrow_the_santerians.sql` — tables `levels`, `member_levels`, `generation_progress`,
  `parameter_versions`, `commission_events`, `financial_transactions`, `user_balances`.
- `0006_mlm_seed_and_rls.sql` — seed des 5 niveaux + des 7 paramètres financiers par défaut
  (section 12), RLS sur les 7 tables.
- `0007_illegal_swarm.sql` — tables `payments` et `payment_events`. Enums `payment_method`
  (MOBILE_MONEY/ADMIN_CREDIT/WALLET), `payment_purpose` (REGISTRATION), `payment_status`
  (PENDING/CONFIRMED/FAILED/CANCELLED/REFUNDED).
- `0008_payments_rls.sql` — RLS sur les deux tables.
- `0009_flowery_stepford_cuckoos.sql` — tables `rewards` et `member_rewards`. Enums `reward_type`
  (PHYSICAL/CASH/VOUCHER/OTHER) et `member_reward_status` (ELIGIBLE/CLAIMED/PROCESSING/DELIVERED).
- `0010_rewards_seed_and_rls.sql` — seed des 3 récompenses par défaut (téléphone niveau 3, moto
  niveau 4, voiture niveau 5 — section 16), RLS sur les deux tables.
- `0011_tense_ravenous.sql` — tables `courses`, `course_levels`, `modules`, `lessons`,
  `lesson_progress`. Enum `video_provider` (YOUTUBE/VIMEO/OTHER).
- `0012_lms_seed_and_rls.sql` — seed d'un cours de démonstration (niveau 1, 1 module, 2 leçons)
  utilisé par le script de vérification live, RLS sur les 5 tables.
- `0013_glorious_zodiak.sql` — table `audit_logs` (Phase 9, section « Administration » du plan par
  phases : traçabilité des actions admin).
- `0014_audit_logs_rls.sql` — RLS sur `audit_logs` (pas de policy SELECT membre : lecture
  admin uniquement, via les pages `/admin/*` gardées par `requireAdmin()`).
- `0015_simple_madame_web.sql` — `profiles.username` ajoutée nullable + unique (impossible
  d'ajouter directement en `NOT NULL` : une vraie ligne existait déjà en base).
- `0016_backfill_username.sql` — backfill manuel des profils antérieurs à cette colonne
  (`membre_` + les 8 premiers caractères de l'id, déterministe donc trivialement unique).
- `0017_fresh_eternity.sql` — `profiles.username` passée en `NOT NULL` une fois le backfill fait.
- `0018_level_names.sql` — noms de palier réels (Bronze/Argent/Or/Platine/Diamant) remplaçant le
  placeholder « Niveau N » du seed de la Phase 4.
- Restent à migrer : rien de bloquant pour le plan en 11 phases ; `quizzes`/`documents`/
  `certificates` esquissés dans le rapport d'architecture initial sont hors du périmètre retenu
  pour la Phase 7 (voir écart ci-dessous) et referont l'objet d'une phase dédiée si besoin.

**Piège `ILIKE` + pseudos** : en SQL, `_` dans un motif `LIKE`/`ILIKE` signifie « n'importe quel
caractère », pas un underscore littéral — or tous les pseudos de ce projet peuvent en contenir
(`^[a-z0-9_]+$`). `searchDescendantsByUsername` (`repositories/binary-nodes.ts`) construisait le
motif directement depuis la saisie utilisateur sans l'échapper, faussant les résultats dès que la
recherche contenait un underscore (repéré via un script de vérification : une recherche par
préfixe attendait 32 résultats à la génération 5, un premier essai en trouvait un mauvais compte
avant que la limite par défaut soit aussi mise en cause — deux bugs distincts, voir ci-dessous).
Corrigé en échappant `\`, `%` et `_` dans la saisie avant de construire le motif
(`escapeLikePattern`). Tout futur `ILIKE`/`LIKE` sur une saisie libre doit faire de même — ce
n'est pas spécifique aux pseudos, `listMembers` et les autres recherches admin filtrent en mémoire
plutôt qu'en SQL et n'y sont donc pas exposées, mais toute future recherche SQL directe le sera.

**Piège renumérotation de migration** : `drizzle-kit generate` attribue le prochain numéro en se
basant sur le journal, pas sur les fichiers présents sur le disque. En écrivant `0016_backfill_username.sql`
à la main (nécessaire entre les deux migrations générées, pour respecter l'ordre nullable→backfill→NOT NULL),
`drizzle-kit generate` ignorait son existence (jamais enregistrée au journal) et a aussi proposé
`0016_fresh_eternity.sql` pour l'étape `SET NOT NULL` — collision de préfixe. Corrigé en renommant le
fichier généré en `0017_fresh_eternity.sql` et en ajoutant les deux entrées de journal dans le bon
ordre chronologique (voir le piège horodatage ci-dessus pour pourquoi l'ordre du `when` compte
vraiment, pas seulement le nom de fichier).

**Piège horodatage de migration (`meta/_journal.json`)** : `drizzle-kit migrate` détermine les
migrations restant à appliquer en comparant le `when` de chaque entrée du journal au
`created_at` maximum déjà enregistré dans `drizzle.__drizzle_migrations` — **pas** par ordre
d'`idx`/de nom de fichier. En Phase 7, l'entrée `0012_lms_seed_and_rls` avait été ajoutée à la main
avec un `when` arbitraire (`1786320000000`) plus grand que l'horodatage réel généré ensuite pour
`0013` (`1786274370785`). Résultat en Phase 9 : `drizzle-kit migrate` a silencieusement ignoré
`0013` et `0014` (leur `when` étant antérieur au faux « déjà appliqué » de `0012`) tout en
affichant `[✓] migrations applied successfully!` — aucune erreur, juste un no-op déguisé en succès.
Repéré en constatant que `audit_logs` n'existait pas alors que la migration avait « réussi ».
Corrigé en réalignant le `when` de `0012` sur une valeur chronologiquement cohérente **et** en
corrigeant le `created_at` déjà enregistré en base pour la ligne correspondante — éditer le seul
fichier journal ne suffit pas, la table de suivi elle-même garde la valeur erronée tant qu'elle
n'est pas corrigée à la main. Leçon : toute entrée de journal ajoutée manuellement (migrations
seed/RLS écrites à la main plutôt que générées par `drizzle-kit generate`) doit recevoir un `when`
strictement compris entre son prédécesseur et son successeur réels, jamais une valeur ronde
arbitraire dans le futur.

**Piège Drizzle + Supabase** : `src/db/schema/profiles.ts` déclare une table `auth.users` "fantôme"
(un seul champ `id`) uniquement pour que la FK de `profiles` soit typée. `drizzle-kit generate`
propose un `CREATE TABLE "auth"."users"` la première fois qu'il la découvre — il faut retirer
cette instruction à la main dans le SQL généré avant de migrer (déjà fait pour `0001` ; les diffs
suivants, `0003` inclus, ne l'ont plus reproposée une fois la table connue du snapshot Drizzle).

**Piège ltree + UUID** : les labels ltree n'acceptent que lettres/chiffres/underscore — un UUID
brut (avec tirets) n'est pas un label valide. `src/services/genealogy/ltree.ts` dérive le label en
retirant les tirets (`toLtreeLabel`), et l'id du nœud est généré côté application
(`crypto.randomUUID()`) plutôt que par la DB, pour connaître le chemin _avant_ l'insertion.

**Piège tableaux + `sql` de Drizzle** : interpoler un tableau JS dans un template
`` sql`...` `` l'étend en liste parenthésée (`($1, $2)`), pas en tableau Postgres — utilisable
avec `IN`, pas avec `= ANY(...)` (qui exige un vrai tableau). Repéré en testant
`findDescendantsAtDepths` contre une vraie base avant de considérer la Phase 3 terminée (voir plus
bas), et retombé dedans en écrivant le script de vérification de la Phase 4 (nettoyage avec
`= ANY(tableau_ids)`) — corrigé de la même façon (`IN ${tableau}`). `inArray()` du query builder
Drizzle (utilisé dans `unlock-level.ts`) n'a pas ce problème : c'est le `sql` brut spécifiquement
qui interpole les tableaux en liste, pas en tableau Postgres.

**Piège suppression + ledger financier** : `commission_events` et `financial_transactions`
référencent `profiles` sans `ON DELETE CASCADE` (volontairement, comme `binary_nodes` plus haut —
section 19 : une transaction financière n'est jamais supprimée). Un script de test qui supprime
des utilisateurs doit donc nettoyer ces deux tables explicitement en premier (`financial_transactions`
avant `commission_events`, puisque la première référence la seconde), avant de toucher à `profiles`
ou `auth.users` — sinon la suppression échoue avec une violation de contrainte. Ce n'est pas un bug
du schéma, c'est le schéma qui protège le ledger. `payments` suit la même règle (pas de cascade
depuis `profiles`) — voir `ARCHITECTURE.md` pour l'ordre complet de nettoyage utilisé en Phase 5.

**Piège transactions imbriquées** : `placeMember`/`createRootNode` (Phase 3) ouvraient à l'origine
leur propre `db.transaction()`. En Phase 5, `activateRegistration` doit appeler ces fonctions
_dans sa propre transaction_ (paiement confirmé + activation + placement + niveau 1 + commission
directe doivent réussir ou échouer ensemble) — mais `db.transaction()` imbriqué dans un autre
`db.transaction()` ouvre en réalité une **connexion séparée** du pool, pas une vraie transaction
imbriquée : un rollback de la transaction externe n'annulerait pas les écritures déjà validées de
la transaction interne. Corrigé en refactorisant `placeMember`/`createRootNode` pour accepter un
`Executor` (comme `unlockLevel` depuis la Phase 4) plutôt que d'ouvrir leur propre transaction —
voir `src/db/executor.ts`. Repéré en concevant `activateRegistration`, avant d'écrire le moindre
test — aucune donnée corrompue n'a donc jamais existé, mais le bug aurait été réel dès le premier
paiement confirmé en production.

**Piège `server-only` + outillage hors Next** : le paquet `server-only` ne résout vers son build
no-op que sous la condition d'export `react-server`, que seul le bundler de Next.js définit. Tout
script/test qui importe du code serveur (donc presque tout) en dehors de `next dev`/`next build`
plante sinon. Rencontré trois fois en Phase 5 :

1. Les scripts de vérification live (`tsx`) : contourné avec `NODE_OPTIONS="--conditions=react-server"`
   (déjà utilisé depuis la Phase 3).
2. Les tests Vitest (`moneroo.test.ts`, premier test à importer un module import*ant* `server-only`
   au niveau module) : `resolve.conditions` de Vite ne suffit pas en mode SSR de Vitest — corrigé en
   aliasant `server-only` directement vers le chemin absolu de `server-only/empty.js` dans
   `vitest.config.ts` (son `package.json` n'exporte ce fichier que sous la condition `react-server`,
   donc un alias vers le _specifier_ échoue encore — il faut le chemin de fichier résolu).
3. Le build de production lui-même : `src/config/env.moneroo.ts` validait les clés Moneroo au
   niveau module (comme `config/env.ts`), ce qui faisait échouer `next build` sur la route
   `/api/webhooks/moneroo` tant qu'aucune vraie clé Moneroo n'existe — même piège que `src/proxy.ts`
   en Phase 1. Corrigé en rendant la validation paresseuse (`getMonerooEnv()`, une fonction, pas une
   constante) : seul le code qui traite réellement un paiement échoue si les clés manquent, pas le
   build ni les autres routes.

Workflow : modifier `src/db/schema/*.ts` puis `npm run db:generate` (crée une migration SQL sous
`src/db/migrations/`), relire le SQL généré, puis `npm run db:migrate` pour l'appliquer sur
`DATABASE_URL`.

## Schéma cible (validé, implémenté au fil des phases)

24 tables au total (moins que la liste initialement imaginée — voir écarts ci-dessous), groupées
par domaine. Les écarts sont documentés avec leur justification — pas de renommage silencieux.

**Écarts par rapport au schéma initialement imaginé :**

- `level_progress` **retirée** : c'était une simple somme des lignes `generation_progress`
  d'un (user, level) — une table synchronisée en plus est un point de bug en plus (voir la
  section 15 du rapport d'architecture et les bugs corrigés en Phase 3). Calculée à la demande
  quand le dashboard en aura besoin (Phase 8), pas maintenue en continu.
- `commission_rules` **retirée** : les taux actifs sont lus directement dans
  `parameter_versions` (filtré sur la période effective) plutôt que dupliqués dans une table
  dérivée — une seule source de vérité pour tout paramètre financier versionné, pas deux à
  garder synchronisées.
- `member_levels.status` n'a **pas** de valeur `LOCKED` : l'absence de ligne signifie
  verrouillé, une ligne n'existe que pour un niveau déjà débloqué (`IN_PROGRESS` ou
  `COMPLETED`) — voir `MLM_RULES.md`.
- `member_rewards.status` n'a **pas** non plus de valeur `LOCKED`, même raisonnement : une ligne
  n'existe qu'une fois la récompense réellement débloquée (`ELIGIBLE` au minimum).
- `profiles.username` **ajoutée** (pas dans le schéma initialement imaginé) : pseudo public,
  distinct de `full_name`, affiché sous chaque nœud de l'arbre généalogique
  (`/dashboard/network`). Obligatoire et unique dès l'inscription (`schemas/auth.ts`) ; les
  profils antérieurs à cette colonne ont été rétro-remplis (migration `0016`, voir ci-dessus).
- `enrollments` **retirée** du périmètre LMS : l'accès à un cours est une fonction pure de (niveaux
  débloqués par le membre) × (niveaux requis par le cours via `course_levels`), calculée à la
  demande (`hasCourseAccess`) — pas besoin de persister un état d'inscription séparé qui pourrait
  diverger, même raisonnement que `level_progress`/`commission_rules`.
- `videos`/`documents` (tables séparées), `certificates` **restent hors périmètre** : la
  description de la Phase 7 dans le prompt directeur se limite à « cours, modules, leçons, vidéos,
  progression, accès par niveau » — la vidéo est un champ de `lessons`, pas une table à part.
  `quizzes`/`quiz_questions`/`quiz_attempts` étaient hors périmètre à cette époque-là ; construits
  post-Phase 11 pour la génération de cours par IA (voir plus bas) — reportés, pas abandonnés.
- Hébergement vidéo externe (YouTube non répertorié / Vimeo privé), décidé en Phase 7 plutôt que
  Supabase Storage ou un CDN vidéo dédié — pour éviter un nouveau prestataire payant. Compromis
  assumé : `lessons.video_url` n'est pas une URL signée expirante, donc un lien qui fuite hors de
  l'application contourne le contrôle d'accès par niveau (on masque le lien, on ne le protège pas
  cryptographiquement).

### Identité & généalogie

| Table                 | Rôle                                                                                  | Colonnes clés                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `profiles`            | Profil applicatif 1:1 avec `auth.users`                                               | id, full_name, username (unique), phone, country, role, status                                                    |
| `sponsorships`        | Attribution du parrain, historisée, append-only                                       | user_id (unique), sponsor_id, assigned_at                                                                         |
| `binary_nodes`        | Position dans l'arbre binaire — source de vérité, réutilisée par les 5 niveaux        | user_id (unique), binary_parent_id, binary_position, path (ltree), depth, left_subtree_count, right_subtree_count |
| `levels`              | Définition des 5 niveaux et de leur structure de génération (5 lignes fixes, seedées) | code(1-5), name, config jsonb {generationSizes}, is_active                                                        |
| `member_levels`       | Statut de progression d'un membre sur un niveau — une ligne = niveau débloqué         | user_id, level_code, status(IN_PROGRESS/COMPLETED), started_at, completed_at                                      |
| `generation_progress` | Compteur par génération (1..3), déclenche les commissions à chaque seuil franchi      | user_id, level_code, generation, required_count, current_count, status                                            |

### Financier & commissions

| Table                    | Rôle                                                                                                            | Colonnes clés                                                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parameter_versions`     | Historique versionné de tout paramètre financier configurable (prix, commissions, bonus)                        | parameter_key, value, effective_from, effective_to, created_by                                                                                                       |
| `commission_events`      | Porte l'idempotence — un événement = au plus un paiement                                                        | beneficiary_user_id, source_user_id, type, level_code, generation, amount, dedupe_key (unique)                                                                       |
| `financial_transactions` | Ledger immuable, seule source de vérité du solde (pas de colonne `currency` — XOF partout, système mono-devise) | user_id, type, amount, status, reference (unique)                                                                                                                    |
| `user_balances`          | Cache transactionnel du solde (pas de colonne `version` — pas encore de besoin de verrou optimiste)             | user_id (PK), available_balance, pending_balance, withdrawn_balance, lifetime_earnings                                                                               |
| `payments`               | Intentions/confirmations de paiement — 3 méthodes (MOBILE_MONEY/ADMIN_CREDIT/WALLET)                            | beneficiary_user_id, payer_user_id, granted_by_admin_id, method, amount, provider_reference (unique), idempotency_key (unique), status                               |
| `payment_events`         | Journal brut des webhooks — idempotence via une clé dérivée (Moneroo n'a pas d'ID d'événement officiel)         | payment_id, dedupe_key (unique), event_type, processed_at                                                                                                            |
| `rewards`                | Catalogue des récompenses par niveau                                                                            | level_code, name, value, reward_type(PHYSICAL/CASH/VOUCHER/OTHER), is_active                                                                                         |
| `member_rewards`         | Attribution nominative d'une récompense                                                                         | user_id, reward_id, status(ELIGIBLE/CLAIMED/PROCESSING/DELIVERED)                                                                                                    |
| `withdrawals`            | Demandes de retrait                                                                                             | user_id, amount, method, destination, status                                                                                                                         |
| `wallet_transfers`       | Transfert de solde membre-à-membre, gardé par un OTP email (ajouté après Phase 10)                              | sender_id, recipient_id, amount, status(PENDING_OTP/CONFIRMED/EXPIRED), otp_code_hash, otp_expires_at, otp_attempts, sender_transaction_id, recipient_transaction_id |

### LMS

| Table             | Rôle                                                                                     | Colonnes clés                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `courses`         | Catalogue des cours                                                                      | title, description, is_active                                                                            |
| `course_levels`   | Jonction many-to-many — restriction d'accès par niveau (absence de ligne = cours public) | course_id, level_code                                                                                     |
| `modules`         | Regroupement ordonné de leçons au sein d'un cours                                        | course_id, title, position, is_active                                                                     |
| `lessons`         | Contenu d'un module — VIDEO (hébergée en externe, voir écart ci-dessous) ou TEXT (article + quiz de compréhension), depuis la génération de cours par IA (post-Phase 11) | module_id, title, lesson_type(VIDEO/TEXT), video_provider, video_url, content, position, is_active |
| `lesson_progress` | Une ligne = un membre a marqué une leçon comme terminée                                  | user_id, lesson_id (unique), completed_at                                                                 |
| `quizzes`         | Le quiz de compréhension d'une leçon TEXT — au plus un par leçon                         | lesson_id (unique), passing_score                                                                         |
| `quiz_questions`  | Une question à choix multiple — options en jsonb (pas de table séparée, même logique que `levels.config`) | quiz_id, question, options jsonb [{id,text,isCorrect}], position                          |
| `quiz_attempts`   | Une tentative d'un membre — jamais écrasée, les échecs restent pour audit/retry          | user_id, quiz_id, score, passed, answers jsonb                                                            |

`videos`/`documents` comme tables séparées et `certificates` restent hors périmètre — la vidéo
reste un champ de `lessons`, pas une table à part, et aucune phase n'a encore réclamé les
certificats. Voir l'écart correspondant plus bas pour le raisonnement d'origine (Phase 7).

### Plateforme

| Table        | Rôle                                                                             | Colonnes clés                                                 |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `audit_logs` | Traçabilité de toute action admin — écrite dans la même transaction que l'action | actor_user_id, action, target_type, target_id, metadata jsonb |

`notifications`, `system_settings` (paramètres non financiers), `domain_events` (outbox
événementiel) restent hors périmètre — aucune phase du plan ne les a encore réclamés.

## Index obligatoires

| Table                                   | Index                                                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `binary_nodes`                          | GiST(path) · btree(binary_parent_id) · btree(user_id) unique · btree(depth)                            |
| `sponsorships`                          | btree(sponsor_id) · btree(user_id) unique                                                              |
| `member_levels` / `generation_progress` | btree(user_id, level_code) unique                                                                      |
| `financial_transactions`                | btree(user_id, created_at desc) · btree(type) · btree(reference) unique                                |
| `commission_events`                     | unique(dedupe_key) · btree(beneficiary_user_id, created_at desc)                                       |
| `payments` / `payment_events`           | unique(provider_reference) · unique(idempotency_key) · unique(dedupe_key) · btree(beneficiary_user_id) |
| `wallet_transfers`                      | btree(sender_id) · btree(recipient_id) · btree(status)                                                 |
| `course_levels`                         | btree(course_id, level_code) unique                                                                    |
| `modules`                               | btree(course_id, position) unique                                                                      |
| `lessons`                               | btree(module_id, position) unique                                                                      |
| `lesson_progress`                       | btree(user_id, lesson_id) unique · btree(user_id)                                                      |
| `quizzes`                               | btree(lesson_id) unique                                                                                 |

## Règles

- Les valeurs monétaires sont des entiers XOF, jamais des flottants.
- Aucune transaction financière n'est supprimée ; une correction est une nouvelle transaction
  d'ajustement.
- `binary_nodes` est immuable après insertion (pas de réécriture silencieuse de l'historique de
  placement).
- Toute modification de paramètre financier crée une nouvelle ligne dans `parameter_versions` —
  jamais de mise à jour en place, pour ne pas recalculer rétroactivement l'historique.
- `binary_nodes.binary_parent_id` n'a **pas** de `ON DELETE CASCADE` (volontairement) : un nœud
  qui a des enfants ne peut pas être supprimé, ce qui empêche de casser l'arbre en supprimant un
  compte au milieu d'une branche. `binary_nodes.user_id` a lui `ON DELETE CASCADE` depuis
  `profiles` — en pratique, un vrai profil actif dans l'arbre ne devrait jamais être supprimé en
  dur (anonymisation plutôt que suppression, à traiter en Phase 9).
- `commission_events.beneficiary_user_id` et `financial_transactions.user_id` n'ont pas non plus
  de `ON DELETE CASCADE`, pour la même raison que ci-dessus appliquée au ledger financier
  (section 19) : supprimer un profil qui a déjà reçu une commission est bloqué tant que ces lignes
  existent — c'est voulu, pas un oubli.
- Un compteur `generation_progress.current_count` ne peut jamais dépasser `required_count` : par
  construction, chaque paire (ascendant, descendant) ne déclenche l'incrémentation qu'une seule
  fois, que ce soit via le rattrapage ou la propagation (jamais les deux) — voir `MLM_RULES.md`.

## Vérification live (Phase 3)

`findAncestors`, `findDescendantsAtDepths` et la mise à jour transactionnelle des compteurs de
sous-arbre (`placeMember`) utilisent du SQL brut (opérateurs `ltree`, non exprimables par le query
builder Drizzle) — le typecheck ne peut pas vérifier ce SQL. Avant de considérer la Phase 3
terminée, ce code a été exercé contre la vraie base (utilisateurs de test créés puis supprimés
dans le même script), ce qui a révélé et corrigé trois bugs qu'aucun test unitaire pur ni le build
n'auraient attrapés :

1. Le signe de `findAncestors` était inversé (`nlevel(path) - nlevel(cible)` au lieu de
   `nlevel(cible) - nlevel(path)`) — un ancêtre a toujours un `nlevel` plus petit que le nœud de
   départ.
2. La mise à jour des compteurs `left_subtree_count`/`right_subtree_count` appliquait la position
   du **nouveau nœud** à **tous** ses ancêtres, alors que chaque ancêtre doit s'incrémenter selon
   la position de **son propre enfant** sur le chemin vers le nouveau nœud (correct seulement pour
   le parent direct). Corrigé avec une jointure sur `subpath(chemin_cible, 0, nlevel(ancêtre)+1)`.
3. `= ANY(${tableau})` avec le `sql` de Drizzle échoue : un tableau JS interpolé s'étend en liste
   parenthésée (`($1, $2)`), valide pour `IN (...)`, pas pour `ANY(...)` qui exige un vrai tableau
   Postgres.

## Vérification live (Phase 4)

Le moteur de commissions ne peut pas se permettre un bug silencieux — avant de considérer la
Phase 4 terminée, `unlockLevel` a été exercé contre un arbre réel de 15 membres sur 3 générations
(A → B,C → D,E,F,G → H..O), avec 17 assertions couvrant :

- la complétion du niveau 1 pour A (6/6 via B,C,D,E,F,G) avec paiement du bonus ;
- une génération **incomplète** (D reste `IN_PROGRESS`, G2 sans candidat dans cet arbre) ne
  déclenche **aucune** commission (section 33, test 9) ;
- la cascade automatique niveau 1 → niveau 2 pour A, B et C ;
- une commission de génération niveau 2 correctement calculée (2 000 F × 2 = 4 000 F) une fois que
  B et C ont chacun débloqué le niveau 2 ;
- l'idempotence : rappeler `unlockLevel` sur un niveau déjà débloqué ne fait rien ; retenter
  `createCommissionEvent` avec la même `dedupe_key` ne paie pas deux fois (section 33, test 15) ;
  aucun solde/ligne de ledger en double malgré la tentative ;
- le garde-fou anti-saut de niveau (impossible de débloquer le niveau 3 sans avoir complété 1 et 2).

Aucun bug de logique métier n'a été trouvé dans `unlock-level.ts`/`commission.ts` eux-mêmes — les
deux problèmes rencontrés étaient dans le **script de vérification** (nettoyage dans le mauvais
ordre face aux contraintes `NO ACTION` du ledger, et la même erreur `= ANY(tableau)` qu'en Phase
3), pas dans le code applicatif. Documentés ci-dessus plutôt que passés sous silence.

## Vérification live (Phase 5)

Aucun appel réel à Moneroo (pas de compte configuré) — le webhook a été simulé en signant
localement un payload avec le même secret que `getMonerooEnv()` utilise au runtime, puis en
l'envoyant à `processWebhookEvent` (la même fonction que la vraie route appelle). 17 assertions
couvrant :

- `ADMIN_CREDIT` active un compte (placement + niveau 1 + statut ACTIVE) et refuse un octroyeur
  non-admin (vérifié en interne, pas seulement supposé côté appelant) ;
- la commission directe (500 F) est versée au parrain, jamais au filleul ;
- l'idempotence : rejouer `activateRegistration` sur un paiement déjà `CONFIRMED` ne recrée rien ;
- `WALLET` refuse un payeur qui n'est pas le parrain du bénéficiaire, et un solde insuffisant ;
- `WALLET` débite correctement le portefeuille du parrain (financial_transactions `PAYMENT`
  négatif) tout en lui versant sa commission directe pour ce même filleul ;
- le webhook Moneroo simulé active le compte, et une redélivraison du même événement ne crée ni
  deuxième commission ni deuxième ligne `payment_events` (dédoublonnage par `dedupe_key`).

Un vrai bug de conception a été repéré et corrigé **avant** d'écrire le script de vérification, en
concevant `activateRegistration` : `placeMember`/`createRootNode` ouvraient leur propre
transaction, ce qui aurait cassé l'atomicité du flux paiement→activation dès le premier paiement
confirmé en production — voir « Piège transactions imbriquées » plus haut. Un bug logique dans le
script de test lui-même (parrain fictif donné à la racine de l'arbre, qui aurait fait échouer son
placement) a aussi été repéré et corrigé avant l'exécution.

## Vérification live (Phase 6)

`unlockReward` (appelé depuis `completeLevel` pour tout niveau ≥ 3), `claimReward` et
`updateRewardDeliveryStatus` ont été exercés contre deux membres réels amenés jusqu'aux niveaux 3,
4 et 5 (les seeds de `rewards` : téléphone niveau 3 = PHYSICAL, moto niveau 4 = PHYSICAL, voiture
niveau 5 = PHYSICAL, plus un bonus CASH de 50 000 F ajouté au niveau 3 pour le test). 18 assertions
couvrant :

- une récompense PHYSICAL ne crée **aucune** ligne `user_balances` ni `financial_transactions` —
  seule une récompense CASH crédite le solde (via `creditBalance`, la même fonction que
  `commission.ts`) et écrit une ligne `REWARD` au ledger ;
- re-déclencher `unlockReward` pour un niveau déjà récompensé ne duplique rien
  (`onConflictDoNothing` sur `(user_id, reward_id)`) ;
- un niveau sans récompense configurée ne lève aucune erreur (catalogue vide = no-op) ;
- un membre avec plusieurs récompenses au même niveau (PHYSICAL + CASH) reçoit les deux lignes
  `member_rewards`, mais seule la CASH apparaît au ledger ;
- `claimReward` fait passer `ELIGIBLE` → `CLAIMED` uniquement si le membre est bien le propriétaire
  et que le statut est encore `ELIGIBLE` (double réclamation et réclamation d'autrui rejetées par
  la clause `WHERE`, pas seulement par la logique applicative) ;
- `updateRewardDeliveryStatus` refuse un appelant non-admin (revérifié en interne) et fait
  progresser `PROCESSING` → `DELIVERED` avec horodatage et informations de suivi.

Aucun bug de logique métier trouvé dans `reward.ts`/`claim-reward.ts`/
`update-reward-delivery-status.ts` — la principale décision de conception (récompense CASH
vs. PHYSICAL/VOUCHER/OTHER pour l'impact sur le solde) est documentée dans l'écart ci-dessus et
dans `MLM_RULES.md`.

## Vérification live (Phase 7)

`createCourse`/`createModule`/`createLesson`, `hasCourseAccess` et `markLessonComplete` ont été
exercés contre 4 membres réels (un admin, un avec seulement le niveau 1, un avec les niveaux 1 et
3, un sans aucun niveau) et deux cours créés pour l'occasion (un réservé au niveau 3, un public).
15 assertions couvrant :

- un non-admin ne peut pas créer de cours (rôle revérifié à l'intérieur du service, pas seulement
  supposé côté appelant) ;
- l'accès à un cours réservé au niveau 3 est refusé à un membre n'ayant que le niveau 1 et à un
  membre sans aucun niveau, mais accordé à un membre ayant débloqué le niveau 3 — confirmant la
  sémantique OR de `course_levels` (n'importe lequel des niveaux liés suffit, pas tous) ;
- un administrateur a accès à n'importe quel cours même sans ligne `member_levels` (bypass pour la
  gestion de contenu) ;
- un cours sans ligne `course_levels` est accessible à tout membre, y compris sans aucun niveau
  débloqué (absence de restriction, pas absence d'accès — asymétrique avec `member_levels`, où
  l'absence de ligne signifie verrouillé) ;
- le cours seedé (niveau 1) est accessible à tout membre ayant débloqué le niveau 1 ;
- marquer une leçon comme terminée est refusé sans accès au cours, et refusé sur une leçon
  désactivée ;
- re-marquer la même leçon comme terminée est idempotent (`ON CONFLICT DO NOTHING` sur
  `(user_id, lesson_id)`, toujours une seule ligne) ;
- `getCourseProgress` reflète correctement 1/2 puis 2/2 leçons complétées, et une leçon désactivée
  disparaît à la fois du dénominateur et du numérateur du calcul.

Aucun bug trouvé dans le code applicatif. Un point de conception a été tranché avant l'écriture du
code plutôt que découvert en testant : l'hébergement vidéo externe (embed YouTube/Vimeo) a été
choisi explicitement par l'utilisateur plutôt que Supabase Storage ou un CDN dédié — voir l'écart
correspondant plus haut pour le compromis de sécurité accepté.

## Vérification live (Phase 8)

Les nouvelles fonctions de lecture (`repositories/network.ts`, `financial-transactions.ts`,
`member-levels.ts`, `member-rewards.ts`, et `listCoursesForUser`/`getCourseContent(…, userId)`
ajoutées à `courses.ts`) ont été exercées contre un vrai mini-arbre (racine → B/C → D sous B,
via `createRootNode`/`placeMember`) et des données financières/récompenses/progression insérées
directement. 19 assertions couvrant :

- `getNetworkView` renvoie les bons enfants LEFT/RIGHT avec leurs noms, et les petits-enfants
  correctement rattachés à leur parent (pas mélangés entre B et C) ;
- `getAncestorNames` renvoie les ascendants dans le bon ordre de génération ;
- `listLevelProgress` synthétise correctement `LOCKED` pour les niveaux jamais débloqués (aucune
  ligne `member_levels`) et distingue les générations suivies des niveaux verrouillés ;
- `getBalance` renvoie des zéros par défaut en l'absence de ligne `user_balances`, plutôt que de
  planter ou renvoyer `undefined` ;
- `listMemberRewards` joint correctement `member_rewards` à sa définition `rewards` ;
- `hasCourseAccess` reste correct après l'ajout de `listCoursesForUser` (aucune régression sur le
  comportement vérifié en Phase 7) ;
- `getCourseContent(…, userId)` annote chaque leçon de `completed` correctement avant et après un
  appel réel à `markLessonComplete`, sans affecter les autres leçons du même membre.

Aucun bug trouvé dans les nouvelles fonctions de lecture. **Limite connue de cette vérification** :
aucun outil de navigateur n'est disponible dans cette session pour capturer ou piloter le rendu
visuel réel des nouvelles pages — la correction a été établie par (a) `next build` (typecheck des
routes typées, y compris `PageProps<'/dashboard/courses/[courseId]'>`), (b) le script ci-dessus qui
exerce la couche de données que ces pages consomment, et (c) un sondage HTTP de chaque route en
serveur de développement confirmant une redirection propre vers `/login` (pas de plantage serveur)
pour un visiteur non authentifié. Le rendu JSX lui-même (mise en page, styles) n'a pas été vérifié
visuellement — à faire manuellement par l'utilisateur avant mise en production.

## Vérification live (Phase 9)

`listMembers`, `setMemberStatus`, `listAllCoursesForAdmin` et `listAllMemberRewards` ont été
exercés contre 4 membres réels (un admin, un actif avec niveau 1 et solde, un `PENDING_PAYMENT`,
une cible de suspension) et un cours créé pour l'occasion avec ses niveaux requis insérés en
désordre. 10 assertions couvrant :

- `listMembers` agrège correctement le niveau actuel et le solde disponible par membre (3 requêtes
  batchées — profils, `member_levels`, `user_balances` — pas une par membre) ;
- `setMemberStatus` refuse un appelant non-admin, refuse qu'un admin se suspende lui-même, et
  refuse de suspendre un compte encore `PENDING_PAYMENT` ;
- suspendre puis réactiver un membre actif fonctionne et renvoie le profil mis à jour ;
- `listAllCoursesForAdmin` renvoie les bons compteurs de modules/leçons pour le cours seedé, et
  trie les `levelCodes` (`2,3`) même insérés dans l'ordre inverse (`3,2`) ;
- `listAllMemberRewards` joint correctement le nom du membre à la définition de sa récompense.

Aucun bug trouvé dans les nouvelles fonctions. Même limite qu'en Phase 8 pour le rendu visuel des
pages `/admin/*` — non vérifiable sans outil de navigateur dans cette session, seulement le
sondage HTTP (redirection propre vers `/login`, pas de plantage serveur) et le build typé.

Un vrai trou de spécification a été repéré et corrigé **avant** d'écrire le service de suspension :
le statut `SUSPENDED` de `profiles` existait depuis la Phase 2 mais n'était vérifié nulle part dans
l'application — un membre suspendu aurait continué à voir la vue d'ensemble de son dashboard. Voir
`ARCHITECTURE.md` pour le correctif.

## Vérification live (Phase 9 — complément)

Première tentative de vérification incomplète : le plan initial de la Phase 9 (`/admin` —
utilisateurs, **paiements, commissions, niveaux, récompenses, paramètres versionnés, audit_logs**)
avait été mal reconstitué de mémoire après compaction de contexte — seuls Membres et Récompenses
avaient été construits, plus une section Cours non prévue à ce stade. Comparé au rapport
d'architecture original (relu à la demande de l'utilisateur), il manquait Paiements, Commissions,
Niveaux, Paramètres versionnés et `audit_logs`. Cette section documente la vérification de ce
complément.

`getLevelStats`, `logAdminAction` (câblé dans les 5 services admin existants), `updateParameter`,
`listPayments`, `listCommissionEvents` et `listCurrentParameters` ont été exercés contre 3 membres
réels (un admin, un actif, un `PENDING_PAYMENT`). 12 assertions couvrant :

- `getLevelStats` compte correctement les membres `IN_PROGRESS` par niveau, à l'échelle de toute la
  plateforme (pas par membre) ;
- chaque service admin (`setMemberStatus`, `createCourse`/`createModule`/`createLesson`,
  `updateRewardDeliveryStatus`, `grantAdminCredit`, `updateParameter`) écrit bien une ligne
  `audit_logs` dans la **même transaction** que l'action qu'il journalise ;
- `grantAdminCredit` active correctement un compte `PENDING_PAYMENT` et `listPayments` montre le
  paiement `ADMIN_CREDIT` confirmé avec le nom de l'admin qui l'a accordé ;
- `listCommissionEvents` joint correctement le nom du bénéficiaire ;
- `updateParameter` — le test central de non-rétroactivité : après une première version puis une
  seconde, `effective_to` de l'ancienne version est **strictement égal** à `effective_from` de la
  nouvelle (aucun trou, aucun chevauchement) ; `getCurrentParameterValue` et
  `listCurrentParameters` renvoient tous deux la valeur la plus récente, jamais l'ancienne.

**Deux incidents rencontrés en écrivant cette vérification, aucun dans le code applicatif final :**

1. Un vrai bug de migration (voir le piège horodatage ci-dessus), qui a fait planter le tout
   premier essai avec `relation "audit_logs" does not exist` — corrigé avant de continuer.
2. Deux essais suivants ont planté en cours de script (une fois sur l'erreur de migration
   ci-dessus, une fois sur un `ECONNRESET` réseau transitoire vers le pooler Supabase) **avant**
   d'atteindre la section de nettoyage — laissant des lignes de test orphelines (profils, un cours,
   des `member_levels`). Fait notable : au moment de nettoyer, un **vrai compte utilisateur** de
   l'utilisateur (`ehonam2000@gmail.com`, statut `PENDING_PAYMENT`) était déjà présent en base, créé
   entre deux phases de vérification — la première fois que ce projet contient une donnée réelle,
   pas seulement des lignes de test. Chaque nettoyage a été fait en filtrant explicitement sur les
   adresses `@test.local` généré par le script, jamais par une purge large de `profiles`, pour ne
   jamais risquer ce compte. **Implication pour la suite** : les scripts de vérification futurs ne
   peuvent plus supposer une base vide de `profiles` — les comptages doivent rester scopés aux
   lignes créées par le script, jamais à un total global de table.

## Vérification live (pseudo + arbre généalogique)

**Mise à jour critique de la contrainte ci-dessus** : le compte réel de l'utilisateur
(`ehonam2000@gmail.com`) a depuis utilisé le panneau admin pour s'auto-accorder un crédit
d'inscription (`granted_by_admin_id` = son propre id — usage légitime, pas un bug) et possède donc
désormais **le seul nœud racine de l'arbre binaire** (`binary_nodes.binary_parent_id IS NULL`).
Conséquence directe pour tout script de vérification futur touchant à la généalogie :

- `createRootNode` échoue désormais systématiquement (« Un nœud racine existe déjà ») — plus
  possible de construire un mini-arbre de test isolé avec sa propre racine, comme le faisaient les
  scripts des Phases 3/4/5/8.
- **Ne jamais** appeler `placeMember` en rattachant un utilisateur de test sous ce vrai nœud
  racine : le placement met à jour `left_subtree_count`/`right_subtree_count` sur **tous** les
  ancêtres, y compris la racine réelle, et il n'existe aucune façon de « dé-placer » un nœud —
  supprimer le nœud de test après coup ne restaurerait pas les compteurs déjà incrémentés sur le
  vrai compte. Toute vérification touchant `placeMember`/`getNetworkView` sur un scénario à
  plusieurs générations doit désormais rester en lecture seule contre l'arbre réel (voir ci-dessous)
  plutôt que de construire un nouvel arbre.

Sur ce principe, `insertProfileIfMissing` (collision de pseudo) et `getNetworkView` (nouveau champ
`username`) ont été vérifiés avec 6 assertions : deux profils de test créés avec le même pseudo
demandé (« sameuser ») — le second reçoit automatiquement un suffixe plutôt que de faire échouer
l'inscription ; `findProfileByUsername` retrouve le bon profil ; rappeler
`insertProfileIfMissing` pour un id déjà existant reste un no-op (aucun doublon) ; et, en lecture
seule contre le vrai compte racine, `getNetworkView` renvoie correctement son pseudo réel
(`membre_ad0f540d`, celui généré par le backfill de la migration `0016`) sans planter même sans
descendance. Aucun bug trouvé — le seul incident a été le premier essai qui a tenté
`createRootNode` avant que la contrainte ci-dessus soit comprise, corrigé en réécrivant cette
partie du script en lecture seule avant de le relancer.

Comme pour les Phases 8/9, le rendu visuel de l'arbre (`GenealogyTree`, `TreeNode`,
`BinaryConnector`) n'a pas pu être vérifié à l'œil, faute d'outil de navigateur dans cette
session — seulement `next build` (typecheck) et le script de données ci-dessus.

## Remise à zéro complète (post-Phase 10)

**La contrainte « un vrai compte possède l'unique racine » ci-dessus ne tient plus.** À la demande
explicite de l'utilisateur (les comptes de démonstration empêchaient de tester correctement), les
62 comptes créés pour faire progresser le compte réel jusqu'au niveau 2 (Phases « fais finir le
niveau 1/2 ») ont été supprimés, et le compte réel lui-même a été remis à l'état « vient de
s'inscrire » : `binary_nodes`, `member_levels`, `generation_progress`, `user_balances`,
`financial_transactions`, `commission_events`, `payments` et `audit_logs` vidés pour ce compte,
`profiles.status` remis à `PENDING_PAYMENT`. Le rôle `ADMIN` et le profil lui-même (id, pseudo,
email) ont été conservés — seule la progression MLM a été effacée, pas l'identité ni l'accès admin.

**La base est de nouveau entièrement vide de placement** (0 ligne dans `binary_nodes`) : un futur
script de vérification peut donc de nouveau appeler `createRootNode` une fois, comme en Phases
3-8 — mais dès qu'un vrai compte (le sien ou un autre) s'active pour de vrai et redevient
racine, la même contrainte reviendra. Vérifier l'état de `binary_nodes` avant de supposer quoi que
ce soit plutôt que de se fier à cette note, qui se périmera à la prochaine vraie activation.

## Vérification live (transferts entre membres, post-Phase 10)

Migrations `0019` (ajout `wallet_transfers` + valeurs d'enum `TRANSFER_SENT`/`TRANSFER_RECEIVED`
sur `financial_transaction_type`, générée par `drizzle-kit generate`) et `0020` (RLS, écrite à la
main comme `0008_payments_rls`/`0014_audit_logs_rls`) appliquées sans incident.

Script temporaire, 2 profils de test créés directement en base (`INSERT INTO auth.users (id,
email)` minimal — seule `id` est `NOT NULL` sans défaut sur cette table gérée par Supabase,
vérifié via `information_schema.columns` avant d'écrire le script) puis nettoyés. 35 assertions,
détail dans `ARCHITECTURE.md`/`TESTING.md`. Un seul incident, dans le script lui-même, pas dans le
code applicatif : le nettoyage utilisait `WHERE id = ANY(${tableau})` — le même piège Drizzle déjà
documenté en Phase 3 (un tableau JS interpolé via `sql` s'étend en liste parenthésée, valide pour
`IN`, pas pour `ANY()` qui exige un vrai tableau Postgres) — corrigé en `IN`, rejoué avec succès.

## Vérification live (schéma pivot formation/ambassadeur, Phase 11 — schéma seul)

Migrations `0021_business_model_schema.sql` (5 nouvelles tables — `ambassador_profiles`,
`referral_clicks`, `sales`, `commission_rules`, `refunds` — + colonnes ajoutées à `courses` et
`generation_progress` + extensions d'enum, générée par `drizzle-kit generate`) et
`0022_business_model_backfill.sql` (hand-written : slug de l'unique cours seedé, backfill
`ambassador_profiles` pour tout compte déjà placé dans l'arbre — 0 ligne aujourd'hui, la base ayant
été remise à zéro juste avant) appliquées sans incident. Détail complet du schéma et des choix de
conception dans `ARCHITECTURE.md` (section « Pivot formation + programme ambassadeur »).

Script temporaire, 16 assertions : slug backfillé (`bienvenue-dans-le-programme`), unicité de
`referral_code` bien rejetée sur doublon, insertion croisée réussie dans les 5 nouvelles tables
(FK `sales.attribution_id → referral_clicks`, `refunds.sale_id → sales`, etc.), les 4 nouvelles
valeurs d'enum acceptées, `generation_progress.bv_total` présent avec défaut `0`. Nettoyage complet
re-vérifié. **Important** : ce n'est qu'un schéma — aucun service existant ne le lit ni ne l'écrit
encore ; `activate-registration.ts`, `unlock-level.ts` et `hasCourseAccess` n'ont pas changé de
comportement (vérifié par la suite complète : 54 tests, `typecheck`, `lint`, `build`, tous verts
avant et après).

## Vérification live (programme ambassadeur — `join-program.ts`, Phase 11)

**La contrainte de racine unique est revenue** entre la vérification ci-dessus et celle-ci : un
vrai compte s'est activé pour de vrai via `activate-registration.ts` (toujours inchangé et
fonctionnel) et détient de nouveau l'unique racine de `binary_nodes`. Migration
`0023_ambassador_backfill_catchup.sql` écrite pour rattraper son `ambassador_profiles` (le backfill
de `0022` avait tourné avant cette activation, donc sur une base encore vide). Appliquée sans
incident.

Script temporaire, 18 assertions, détail dans `ARCHITECTURE.md`. Le compte réel racine a été traité
en lecture seule tout du long — jamais modifié, seulement utilisé comme vrai parrain pour des
comptes de test jetables, nettoyage vérifié après coup par une relecture confirmant que sa ligne
`binary_nodes` est intacte. Aucun bug trouvé dans `join-program.ts` lui-même ; un bug réel trouvé et
corrigé dans `assign-sponsor.ts` avant même d'écrire le script (voir `ARCHITECTURE.md`) — même
classe de bug que le nested-transaction de la Phase 5, jamais déclenché jusqu'ici faute d'appelant
qui l'imbriquait dans une transaction externe.

## Vérification live (catalogue vendable + achat direct — TEST 6, Phase 11)

Pas de nouvelle migration cette fois — uniquement de la logique au-dessus du schéma posé en Phase 1
(`courses.price`/`business_volume`/`slug`, `sales`, l'enum `payment_purpose.COURSE_PURCHASE`).

Script temporaire, 26 assertions, détail complet dans `ARCHITECTURE.md`. La clé API Moneroo réelle
étant invalide (401, déjà signalé, sans lien avec ce chantier), l'appel HTTP de
`initiateCoursePurchase` vers Moneroo n'a pas pu être exercé pour de vrai — le script construit
directement la ligne `payments` équivalente et vérifie tout le reste (webhook → confirmation →
accès → idempotence) avec les vraies fonctions ; les rejets qui se produisent avant l'appel Moneroo
(cours sans prix, achat en double) ont eux été vérifiés via le vrai `initiateCoursePurchase`. Aucun
bug trouvé dans le code applicatif ; deux pièges de nettoyage dans le script lui-même
(`payment_events` avant `payments`, `audit_logs` avant la suppression d'un profil de test
administrateur — mêmes contraintes non cascadantes que d'habitude), corrigés avant le nettoyage
final.

## Vérification live (attribution + commission sur vente directe, Phase 11)

Deux migrations : `0024_direct_sale_commission_type.sql` (ajout `DIRECT_SALE` à l'enum
`commission_type`, générée) et `0025_attribution_parameter_seed.sql` (hand-written, seed
`attribution.cookie_days = 30`, même motif que le seed du barème en migration 0006). Appliquées
sans incident.

Script temporaire, 24 assertions, détail complet dans `ARCHITECTURE.md`. Un ambassadeur de test a
été créé en insérant directement une ligne `ambassador_profiles` plutôt qu'en passant par
`joinAmbassadorProgram` — délibéré : l'attribution/la commission ne touchent ni `binary_nodes` ni
`sponsorships`, donc revalider tout le mécanisme de placement (déjà couvert en Phase 11 précédente)
n'apportait rien ici, et évitait de retoucher à la contrainte de racine unique de l'arbre réel. Deux
pièges de nettoyage dans le script (pas dans le code applicatif) : `financial_transactions` doit
être supprimée avant `commission_events` (FK non cascadante), et les profils de test doivent être
nettoyés (`audit_logs`, `payments`/`payment_events`, `sales`, `commission_events`,
`financial_transactions`, `user_balances`, `referral_clicks`, `commission_rules`) avant leur
`auth.users` — même discipline que d'habitude, un run interrompu a laissé des orphelins
`tmp_attr_*` nettoyés séparément avant de rejouer le script corrigé.

## Vérification live (moteur de qualification par génération/BV, Phase 11)

Une migration : `0026_generation_commission_type.sql` (ajout `GENERATION` à l'enum
`commission_type`, générée). Appliquée sans incident.

Script temporaire, 18 assertions, détail complet dans `ARCHITECTURE.md`. Contrairement aux
vérifications précédentes de cette phase, celle-ci a dû construire une vraie chaîne à 4 générations
(`racine réelle → A1 → A2 → A3 → vendeur`) via `joinAmbassadorProgram`, parce que
`propagateSaleVolume` a réellement besoin de l'arbre binaire (`findAncestors`), contrairement à
l'attribution seule. Le niveau 1 de A1/A2/A3 a été complété par mise à jour directe plutôt que par
6 vraies inscriptions (hors périmètre de ce test précis, déjà couvert ailleurs), puis les niveaux 2
et 3 débloqués via le vrai `unlockLevel`. Racine réelle vérifiée intacte après le nettoyage complet
(financial_transactions/commission_events avant les profils, comptes de test supprimés du plus
profond au moins profond).

## Vérification live (remboursements, Phase 11)

Aucune nouvelle migration — `refunds`, `sales.status = REFUNDED` et l'enum
`financial_transaction_type.COMMISSION_REVERSAL` existent depuis le schéma de la Phase 1, restés
inutilisés jusqu'à cette phase.

Script temporaire, 22 assertions, détail complet dans `ARCHITECTURE.md`. Chaîne à 2 niveaux sous la
racine réelle (P → A), suffisante ici contrairement à la chaîne à 4 niveaux de la vérification
précédente : cette phase teste le *reversal* d'un mécanisme déjà entièrement vérifié, pas le
mécanisme de propagation lui-même. Un run interrompu par une erreur de script (cours de test créés
sans restriction de niveau, donc publics par défaut — voir « Piège » dans `ARCHITECTURE.md`) a
laissé des orphelins `tmp_ref_*` nettoyés séparément avant de rejouer le script corrigé. Racine
réelle vérifiée intacte après coup.

## Vérification live (dashboards client/ambassadeur, Phase 11)

Aucune migration — cette phase n'ajoute aucune colonne/table, seulement des requêtes de lecture
(`listPurchasesForBuyer`, `listSalesForAmbassador`) et du rendu conditionnel.

Script temporaire, 9 assertions : les deux nouvelles requêtes renvoient les bonnes données pour un
vrai acheteur/ambassadeur/vente, et des listes vides pour qui n'a ni achat ni vente attribuée.
Détail dans `ARCHITECTURE.md`, y compris la limite assumée : pas de vérification visuelle
navigateur possible faute de clé `service_role`/identifiants de test (même contrainte que les
tests e2e, voir `TESTING.md`) — compensé par `build`/`typecheck` bout en bout et un smoke-test du
serveur de développement sur chaque route nouvelle/modifiée.

## Vérification live (retrait des points d'entrée de l'ancien système, Phase 11 — fin)

Aucune migration — dernière phase du pivot, uniquement du retrait de code UI et une correction de
logique métier (`setMemberStatus`). Détail complet, y compris le bug de réactivation trouvé et
corrigé en deux temps, dans `ARCHITECTURE.md`.

Script temporaire, 11 assertions. Trois comptes de test placés sous la racine réelle (jamais
modifiée) : un client jamais activé, un ambassadeur réel via `joinAmbassadorProgram`, et un
troisième simulant précisément l'état produit par l'ancien flux payant (position réelle dans
l'arbre, ligne `ambassador_profiles` explicitement supprimée après coup) — ce dernier cas est
exactement celui que la première version de la correction aurait cassé. Racine réelle vérifiée
intacte après nettoyage.

**Le pivot formation + programme ambassadeur (Phase 11, 8 phases) est maintenant complet** :
schéma, opt-in gratuit, catalogue vendable, attribution, qualification par BV, remboursements,
dashboards séparés, retrait des points d'entrée obsolètes — chacune vérifiée en conditions réelles
avant de passer à la suivante.

## Barème BV initial (14 règles `commission_rules`, post-Phase 11)

À la demande explicite de l'utilisateur, 14 règles `GENERATION` (une par couple niveau/génération)
ont été créées via le vrai service admin (`createGenerationCommissionRule`, journalisé dans
`audit_logs`), toutes avec `requirePresence: false` — plus aucune de ces générations ne peut se
compléter sur le seul effectif, uniquement sur le BV. Valeurs dérivées de l'ancien barème plat déjà
documenté (`FINANCIAL_MODEL.md`) et des pourcentages d'exemple du prompt directeur (section 16 :
N2=10 %, N3=8 %, N4=6 %, N5=5 %) — le seuil de BV de chaque règle est calculé pour qu'une
génération pile au seuil verse le même montant total qu'avant sous l'ancien système par effectif,
pas une valeur inventée sans ancrage. Niveau 1 : les deux règles n'affectent que le critère de
qualification (BV minimum 10 000 / 20 000) — aucun montant n'est jamais versé par génération à ce
niveau (seul le bonus fin de niveau 1 existe, inchangé). Détail complet, table et logique de calcul
donnés à l'utilisateur en conversation — à ajuster librement depuis `/admin/commission-rules`,
chaque nouvelle règle sur le même couple (niveau, génération) ferme automatiquement la précédente.
Vérifié après coup : aucune ligne `generation_progress` existante n'a été affectée par la simple
création de ces règles (la complétion n'est réévaluée qu'au prochain événement réel — nouvelle
adhésion ou nouvelle vente).

## Vérification live (leçons texte + quiz — Phase A de la génération de cours par IA)

Fondations schéma pour deux fonctionnalités demandées par l'utilisateur : des formations
entièrement en leçons-texte avec quiz de compréhension bloquant (certaines formations n'auront
jamais de vidéo), et la génération de cours complets par IA (Claude) qui produira ce type de
contenu. Migration `0027` : `lessons.video_provider`/`video_url` passent de NOT NULL à nullable
(aucune perte, juste un desserrage de contrainte), nouvelle colonne `lesson_type`
(VIDEO/TEXT, défaut VIDEO) et `content` (article texte, nul pour les leçons vidéo), plus 3 nouvelles
tables `quizzes`/`quiz_questions`/`quiz_attempts`.

**Vérifié en conditions réelles** (script temporaire, nettoyé) : les 2 leçons vidéo déjà existantes
restent inchangées après migration (`lesson_type=VIDEO`, `video_url` toujours renseigné) ; une
leçon TEXT de test créée avec `content` et sans vidéo fonctionne ; un quiz + une question (options
en jsonb) + une tentative (réponses en jsonb) font un aller-retour correct ; l'index unique
`quizzes_lesson_id_unique` refuse bien un second quiz sur la même leçon ; la suppression en cascade
depuis `courses` nettoie bien jusqu'aux leçons.

Cette phase est **schéma seul** — aucun service (`createLesson`, `markLessonComplete`) ni aucune
UI n'exploite encore `lesson_type`/`content`/les tables de quiz. La page cours apprenant a reçu
l'ajustement minimal nécessaire pour rester type-safe (`lesson.videoUrl` est maintenant nullable) :
une leçon sans vidéo affiche son titre en texte simple au lieu d'un lien mort, en attendant la
vraie UI de lecture/quiz d'une phase suivante.
