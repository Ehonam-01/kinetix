# Stratégie de tests

Quatre niveaux, chacun avec un rôle précis — voir aussi les sections « Vérification live »
de `DATABASE.md`, écrites phase par phase.

## 1. Tests unitaires (Vitest, `npm test`)

Réservés à la logique **pure** (aucun accès réseau/DB) : algorithmes, validation, dérivation de
clés. Rapides, déterministes, aucun effet de bord — c'est la seule catégorie exécutée
automatiquement à chaque `npm test`.

| Fichier                                | Couvre                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `services/genealogy/placement.test.ts` | `findPlacementSlot` — descente gloutonne, branche la plus légère d'abord (5 cas) |
| `services/genealogy/ltree.test.ts`     | `toLtreeLabel`, `childPath`                                                      |
| `services/mlm/dedupe-keys.test.ts`     | Unicité et stabilité des clés d'idempotence des commissions                      |
| `repositories/binary-nodes.test.ts`    | `escapeLikePattern` — voir « Bug trouvé » ci-dessous                             |
| `app/admin/nav-items.test.ts`          | `findAdminSectionLabel` — résolution de route la plus longue en premier          |
| `app/dashboard/nav-items.test.ts`      | `findDashboardSectionLabel`, idem côté membre                                    |
| `schemas/auth.test.ts`                 | `registerSchema` (dont le pseudo), `loginSchema`, etc.                           |
| `services/payments/moneroo.test.ts`    | Signature webhook HMAC, mapping de statut, dérivation de `dedupe_key`            |
| `services/wallet/otp.test.ts`          | Génération/hash/vérification de l'OTP des transferts entre membres               |
| `lib/utils.test.ts`                    | `cn` (fusion de classes Tailwind)                                                |

**54 tests** au total (`npm test`). Le moteur MLM lui-même (`unlock-level.ts`, `commission.ts`,
`reward.ts`) n'a **pas** d'équivalent pur testable ainsi : ces fonctions sont volontairement
couplées à Drizzle/Postgres (transactions réelles, `ltree`), pas extraites en logique pure — voir
la section 2. `services/wallet/initiate-transfer.ts`/`confirm-transfer.ts` suivent la même
logique (couplés à Postgres par construction — transactions réelles, garde atomique dans la clause
`WHERE`) ; seule leur brique pure (`otp.ts`) a un test unitaire, le reste est couvert en Phase
« vérification live » ci-dessous.

**Bug trouvé en écrivant cette suite** (Phase 10) : `escapeLikePattern`
(`repositories/binary-nodes.ts`) n'était pas testée isolément avant — le bug qu'elle corrige (`_`
comme joker SQL non échappé, découvert en Phase 8 via un script de vérification) a maintenant un
test de régression permanent, pas seulement une correction ponctuelle.

## 2. Vérification live contre une vraie base (scripts temporaires, `tsx`)

La méthode utilisée pour tester le moteur MLM et tout code touchant à Postgres/`ltree` depuis la
Phase 3 : un script `src/_tmp_verify_*.ts` écrit des utilisateurs de test réels, appelle les
**vraies fonctions de service en production** (jamais une réimplémentation — un test qui rejoue sa
propre copie de la logique peut rester vert pendant que le vrai code a un bug), fait des
assertions, nettoie tout, puis le script est supprimé. Chaque phase de ce projet a son résumé dans
`DATABASE.md` (« Vérification live (Phase N) »).

Ce n'est **pas** automatisé (pas de `npm run verify`) — volontairement : ces scripts créent et
suppriment des lignes réelles, ce qui ne doit se produire que sous supervision, pas dans une CI qui
tournerait sur la même base partagée.

### Contrainte découverte en Phase 9-10 (levée depuis, voir note en bas)

La base de développement n'est plus vide : le compte de l'utilisateur possède l'unique racine de
l'arbre binaire de toute la plateforme (règle métier : un seul arbre, jamais deux racines). Deux
conséquences permanentes pour tout script futur :

- **Jamais** de nouveau `createRootNode` dans un script — échoue systématiquement.
- **Jamais** de `placeMember` qui rattache un nœud de test à l'arbre réel : les compteurs de
  sous-arbre (`left_subtree_count`/`right_subtree_count`) des ancêtres sont mis à jour à chaque
  placement, et rien ne permet de les décrémenter après coup. Un test qui ferait ça fausserait les
  chiffres réels du compte à chaque exécution, pour toujours.

Les vérifications qui ont vraiment besoin d'exercer `placeMember`/`unlockLevel` sur un scénario à
plusieurs générations le font désormais en **lecture seule** contre l'arbre réel existant (qui
contient déjà des comptes de démonstration créés à la demande de l'utilisateur, Phases « fais
finir le niveau 1/2 »), jamais en créant leur propre arbre isolé.

**Décision explicite avec l'utilisateur (Phase 10)** : pas de simulation à 32 767 comptes
(scénario G0→G14 du prompt directeur, section 18/33 — texte perdu à la compaction de contexte,
seule la référence dans le rapport d'architecture a survécu). Une base de test dédiée
permettrait de le faire fidèlement sans toucher au compte réel, mais n'a pas été mise en place —
à reconsidérer si le besoin se précise. Les vérifications déjà menées à échelle réelle (jusqu'à
62 comptes de démonstration, niveaux 1 et 2 complétés avec commissions correctes) tiennent lieu de
test d'intégration à grande échelle pour l'instant.

**Levée depuis** : à la demande de l'utilisateur, les 62 comptes de démonstration et toute la
progression du compte réel ont été supprimés (voir `DATABASE.md`, « Remise à zéro complète »). La
base est de nouveau vide de `binary_nodes` — `createRootNode` refonctionne dans un script, jusqu'à
la prochaine vraie activation. Vérifier l'état réel avant de s'y fier.

**Transferts entre membres** (après Phase 10) : script temporaire avec 2 comptes de test réels
(profils + `auth.users`), 35 assertions contre les vraies fonctions `initiateTransfer`/
`confirmTransfer` — validations métier, expiration de l'ancienne demande, plafond de 5 tentatives,
flux nominal (soldes + ledger), rejeu rejeté, code expiré, et rollback complet sur solde devenu
insuffisant entre création et confirmation. Détail dans `ARCHITECTURE.md`. L'appel réseau réel vers
Resend n'a pas pu être vérifié de bout en bout (pas de compte configuré, clé placeholder) —
seul l'échec propre (401) a été observé, cohérent avec la limite déjà documentée pour Moneroo.
Nettoyage cette fois-ci a d'abord échoué sur le même piège `= ANY(tableau)` qu'en Phase 3/4 (voir
plus haut) — corrigé en `IN`, rejoué avec succès, aucune ligne orpheline restante.

## 3. Tests E2E (Playwright, `npm run test:e2e`)

`e2e/smoke.spec.ts`, `e2e/auth.spec.ts`, `e2e/admin.spec.ts` — **8 tests**, tous sans effet de bord
durable (pas de création de compte réel : voir le commentaire dans `auth.spec.ts` sur pourquoi il
n'y a pas de test d'inscription réussie de bout en bout, faute de clé `service_role` pour nettoyer
ensuite).

- Rendu de la page d'accueil.
- Redirection `/dashboard` et `/admin` (+ une sous-page) vers `/login` pour un visiteur non
  authentifié.
- Validation client des formulaires d'inscription (dont le nouveau champ pseudo) et de connexion.
- Un vrai appel à Supabase Auth avec de mauvais identifiants (erreur serveur affichée), sans
  jamais créer de compte.

## 4. `EXPLAIN ANALYZE` des requêtes critiques (Phase 10)

Exécuté contre la vraie base (lecture seule, sans danger) sur les requêtes `ltree` et les plus
grosses agrégations :

- **`path @> ...` (ancêtres, `findAncestors`)** : utilise bien l'index GiST
  (`Bitmap Index Scan on binary_nodes_path_gist_idx`), comme prévu par le choix d'architecture.
- **`path <@ ...` (descendants)** et la recherche de pseudo (`ILIKE`) : `Seq Scan` à la taille
  actuelle (~60 lignes) — attendu, pas un bug : le planificateur Postgres préfère à raison un
  balayage séquentiel à un index tant que la table est petite. À revérifier quand le volume réel
  augmentera.
- **`audit_logs` trié par `created_at DESC`** : `Seq Scan` + tri explicite malgré l'index
  `audit_logs_created_idx` existant — même raison (table minuscule, l'index ne serait pas plus
  rapide qu'un tri en mémoire sur si peu de lignes).
- **Recommandation pour plus tard** : la recherche de pseudo (`ILIKE '%...%'`, joker en tête) ne
  peut pas être servie par un index B-tree classique. Si le volume de membres grandit au point que
  le balayage séquentiel devienne coûteux, ajouter l'extension `pg_trgm` et un index GIN
  trigramme sur `profiles.username` plutôt que d'essayer d'indexer différemment.

## Commandes

| Commande            | Rôle                                                      |
| ------------------- | --------------------------------------------------------- |
| `npm test`          | Tests unitaires (Vitest) — rapide, sûr, à lancer souvent. |
| `npm run test:e2e`  | Tests E2E (Playwright) — démarre/réutilise `next dev`.    |
| `npm run typecheck` | TypeScript strict.                                        |
| `npm run lint`      | ESLint (flat config, `next lint` supprimé en Next.js 16). |
