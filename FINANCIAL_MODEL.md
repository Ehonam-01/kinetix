# Modèle financier

Document dû depuis la Phase 4-5, rédigé en Phase 10. Complète `MLM_RULES.md` (qui explique le
_pourquoi_ des règles de progression) en se concentrant sur l'argent lui-même : représentation,
ledger, formules, non-rétroactivité.

## Représentation

Tout montant est un **entier F CFA (XOF)** — cette devise n'a pas de sous-unité, donc jamais de
flottant nulle part dans le système, ni en base (colonnes `integer`) ni en TypeScript. Aucune
colonne `currency` : le système est mono-devise par construction (écart documenté dans
`DATABASE.md`).

## Le ledger : `financial_transactions` fait autorité, `user_balances` est un cache

`financial_transactions` est la **seule source de vérité** du solde d'un membre — chaque ligne y
est immuable une fois écrite (jamais modifiée, jamais supprimée ; une correction est une nouvelle
ligne `ADJUSTMENT`, jamais une réécriture). `user_balances` est un cache transactionnel mis à jour
**dans la même transaction** que chaque écriture du ledger (`services/mlm/credit-balance.ts`,
`creditBalance`, la seule fonction qui écrit dans `user_balances` — partagée par `commission.ts`
et `reward.ts` pour que la logique d'upsert ne diverge jamais entre les deux appelants). Si les
deux tables devaient un jour diverger, `financial_transactions` gagne toujours — une réconciliation
qui recalculerait `user_balances` à partir du ledger est un besoin identifié pour la Phase 11
(cron), pas encore construit.

Types de `financial_transactions.type` : `DIRECT_COMMISSION`, `LEVEL_1_BONUS`,
`LEVEL_COMMISSION`, `REWARD`, `PAYMENT`, `REFUND`, `WITHDRAWAL`, `ADJUSTMENT`, `TRANSFER_SENT`,
`TRANSFER_RECEIVED` (les deux derniers ajoutés pour les transferts entre membres, voir plus bas).

## Barème des commissions

Voir `MLM_RULES.md` (section Commissions) pour le tableau complet et le détail de qui est payé
quand. Résumé des montants par défaut, tous versionnés dans `parameter_versions` (donc modifiables
sans redéploiement, jamais codés en dur dans le moteur) :

| Paramètre                    | Clé                        | Valeur par défaut |
| ---------------------------- | -------------------------- | ----------------- |
| Prix d'inscription           | `registration_price`       | 4 500 F           |
| Commission directe           | `commission.direct`        | 500 F             |
| Bonus fin de niveau 1        | `commission.level_1_bonus` | 1 000 F           |
| Commission niveau 2 (/pers.) | `commission.level.2`       | 2 000 F           |
| Commission niveau 3 (/pers.) | `commission.level.3`       | 3 000 F           |
| Commission niveau 4 (/pers.) | `commission.level.4`       | 20 000 F          |
| Commission niveau 5 (/pers.) | `commission.level.5`       | 50 000 F          |

Les commissions de niveau 2 à 5 se paient **par génération complétée**, montant = taux × taille de
la génération (2, 4 ou 8) — pas par membre individuel. Vérifié en conditions réelles en Phase 10 :
un compte a complété le niveau 1 (2 000 F : 2×500 F directes + 1 000 F de bonus) puis le niveau 2
(28 000 F : 2 000 F × 14 membres répartis sur 3 générations), total 30 000 F, exactement conforme
au calcul attendu.

## Récompenses : `PHYSICAL` ne touche jamais le solde

Décision de conception (Phase 6, déduite de la section 17 du prompt directeur — ne jamais traiter
la valeur d'une récompense matérielle comme une commission) : seul `reward_type = 'CASH'` crédite
`user_balances` (via `creditBalance`, la même fonction que les commissions) et écrit une ligne
`financial_transactions` de type `REWARD`. `PHYSICAL`/`VOUCHER`/`OTHER` ne créent qu'une ligne
`member_rewards` à suivre manuellement (adresse de livraison, statut) — leur `value` est purement
informative, jamais additionnée au solde.

## Non-rétroactivité

`parameter_versions` n'est **jamais** mis à jour en place. Modifier un taux ferme la ligne
actuellement effective (`effective_to = now()`) et en insère une nouvelle démarrant à **cet
instant exact** — capturé via `RETURNING` sur l'`UPDATE` de fermeture, pas un second appel
indépendant à `now()`, pour garantir qu'il n'existe jamais de trou ni de chevauchement entre deux
versions consécutives (`services/admin/update-parameter.ts`, vérifié en Phase 9). Chaque
`commission_event` enregistre le montant déjà calculé au moment du paiement, jamais une référence
vivante vers le taux courant — modifier `commission.level.2` demain n'affecte donc aucune
commission déjà versée.

## Idempotence

Voir `SECURITY.md` (même mécanisme, deux angles différents : ici pour ne jamais payer deux fois,
là-bas pour la sécurité). Chaque commission porte une `dedupe_key` dérivée déterministement de son
identité (`services/mlm/dedupe-keys.ts`) :

- Commission directe : `DIRECT:{parrainId}:{filleulId}`
- Bonus fin de niveau 1 : `LEVEL_1_BONUS:{userId}`
- Commission de génération : `LEVEL_COMMISSION:{userId}:{levelCode}:{generation}`

Un second appel avec la même clé est un no-op (`ON CONFLICT DO NOTHING`), jamais une erreur ni un
double paiement — garanti par construction pour les commissions de génération : chaque paire
(ascendant, descendant) ne peut déclencher l'incrémentation qu'une seule fois (rattrapage **ou**
propagation, jamais les deux — voir `MLM_RULES.md`), donc la clé ne peut physiquement pas être
générée deux fois pour la même progression réelle.

## Transferts entre membres

`wallet_transfers` (table dédiée, un statut `PENDING_OTP → CONFIRMED`/`EXPIRED`) n'est **pas** la
source de vérité du solde — comme pour `payments`/`user_balances`, c'est `financial_transactions`
qui fait autorité. Une confirmation réussie écrit toujours deux lignes symétriques dans le même
mouvement atomique : `TRANSFER_SENT` (montant négatif, chez l'émetteur) et `TRANSFER_RECEIVED`
(montant positif, chez le destinataire), reliées à la ligne `wallet_transfers` par
`sender_transaction_id`/`recipient_transaction_id`, elles-mêmes référencées via
`reference = "TRANSFER:{id}:OUT"` / `"TRANSFER:{id}:IN"` (uniques, dérivées de l'UUID du transfert,
jamais de collision possible). Détail technique complet (services, garde atomique) dans
`ARCHITECTURE.md`.

Aucun frais, aucun plancher/plafond au-delà du solde disponible de l'émetteur — non spécifié par
l'utilisateur au moment de la demande, donc pas ajouté par défaut.

## Ventes de formations (Phase 11, en cours)

`sales` n'est pas non plus la source de vérité du solde — même principe que `payments`/
`wallet_transfers`. `sales.price_paid`/`business_volume` sont des instantanés pris à la confirmation
du paiement, jamais recalculés si le prix/BV de la formation change ensuite (même non-rétroactivité
que `commission_events`/`parameter_versions`).

Un achat direct (sans ambassadeur attribué) ne produit **aucune écriture `financial_transactions`,
aucune ligne `commission_events`** — vérifié en conditions réelles.

## Commission sur vente directe (Phase 11, suite)

L'attribution est maintenant branchée : une vente confirmée avec un ambassadeur résolu (cookie de
parrainage, voir `ARCHITECTURE.md`) déclenche `createCommissionEvent` avec le nouveau type
`DIRECT_SALE` (ledger `DIRECT_SALE_COMMISSION`) — mais **seulement si une règle `commission_rules`
s'applique**. `commission_rules` est versionné exactement comme `parameter_versions` (jamais
modifié en place), avec un `rate` en points de base pour les types `PERCENTAGE`/`BV_PERCENTAGE`
(800 = 8,00 %) et un montant F CFA brut pour `FIXED` — toujours un entier, jamais de flottant,
`Math.floor` à chaque calcul. Le verrou d'idempotence est `dedupe_key = DIRECT_SALE:{saleId}` : la
vente elle-même (déjà protégée par l'idempotence de `confirmCoursePurchase`) fait office de garde,
pas de mécanisme séparé.

**Règle par défaut configurée** : une règle `DIRECT_SALE` globale (ni `courseId` ni `category`,
donc résolue en dernier recours par `getEffectiveDirectSaleRule` pour toute formation sans règle
plus spécifique) est active — `PERCENTAGE`, `rate = 2000` (20,00 %), sans `cap`. Vérifié en
conditions réelles (script temporaire, nettoyé) : 0 règle `DIRECT_SALE` avant, 1 après, calcul
`computeDirectSaleCommission` conforme (9 900 F payés → 1 980 F de commission).

## Commission de génération basée sur le BV (Phase 11, suite)

Deux types de ledger pour la même mécanique (une génération complétée), distingués par si une
règle `commission_rules` a été configurée ou non : `LEVEL_COMMISSION` (comportement historique,
`parameter_versions`, taux × taille de la génération, inchangé — vérifié en conditions réelles)
quand aucune règle n'existe pour ce (niveau, génération) ; `GENERATION_COMMISSION` quand une règle
existe, avec `FIXED` (même sémantique que l'ancien calcul) ou `BV_PERCENTAGE` (pourcentage du BV
accumulé de la génération, jamais `PERCENTAGE` — pas de notion de prix unique à ce niveau). Les
deux partagent la même `dedupe_key` : au plus une commission par (bénéficiaire, niveau, génération),
peu importe laquelle des deux mécaniques la déclenche en premier.

## Valeur du BV en F CFA (post-Phase 11, hors plan initial)

Jusqu'ici, `courses.business_volume` était systématiquement égal au prix — une coïncidence de
saisie, pas une règle. `computeGenerationCommission`/`computeDirectSaleCommission` (type
`BV_PERCENTAGE`) traitaient donc implicitement 1 BV comme valant 1 F CFA. Décision explicite de
l'utilisateur : **1 BV = 1 000 F CFA**, un paramètre versionné (`parameter_versions` clé
`bv.value_in_cfa`, admin-modifiable comme tout autre paramètre) désormais multiplié dans les deux
fonctions avant d'appliquer le pourcentage — `bvTotal` (ou `businessVolume`) est un nombre de
points BV, jamais un montant F CFA directement. Conséquence directe : le BV des 5 formations
réellement au catalogue a été recalculé pour refléter cette convention (ex. une formation à
19 900 F passe de BV = 19 900 à BV = 20), via le vrai service `updateCoursePricing` (pas une
écriture SQL directe) pour conserver la trace d'audit.

Vérifié en conditions réelles (script temporaire, nettoyé) : sans la conversion, une commission de
génération sur une vente de 20 BV aurait été de 2 F (ridiculement faible avec le nouveau barème de
BV) ; avec elle, 2 000 F (10 % de 20 × 1 000 F CFA) — la conversion n'est pas cosmétique, elle
corrige un montant réel qui aurait sinon été mille fois trop petit.

## Remboursements (Phase 11, suite)

`refunds` (schéma posé en Phase 1, câblé ici) ne remplace ni ne réécrit jamais une ligne du ledger —
un remboursement produit une nouvelle ligne `financial_transactions` de type `COMMISSION_REVERSAL`
(montant négatif), jamais une modification de la ligne originale. `sales.status` passe à
`REFUNDED`, jamais supprimée. Reversal exact pour la commission `DIRECT_SALE` (correspondance 1:1
avec la vente) ; le BV de la vente remboursée est retranché du `bv_total` de la génération
concernée, mais une commission `GENERATION` déjà versée n'est jamais automatiquement reversée
(dépend potentiellement de plusieurs ventes, voir `ARCHITECTURE.md`).

## Retraits (post-Phase 11)

Un membre demande un retrait (montant + numéro mobile money) — gardé par un OTP email, exactement
comme un transfert interne (`services/wallet/initiate-transfer.ts`/`confirm-transfer.ts`, même
module `wallet/otp.ts`). `services/wallet/request-withdrawal.ts` valide le montant minimum
(`parameter_versions` clé `withdrawal.minimum_amount`, seedée à 2 000 F, admin-modifiable) et le
solde disponible avant d'envoyer le code. `confirm-withdrawal.ts` ne crédite personne : il déplace
le montant de `available_balance` vers `pending_balance` et insère une ligne `financial_transactions`
(`WITHDRAWAL`, montant négatif, `status = PENDING`) — l'argent ne quitte réellement la plateforme
qu'une fois qu'un administrateur a effectué le virement mobile money **manuellement** et appelé
`services/admin/approve-withdrawal.ts` (aucune intégration de paiement sortant Moneroo n'est
configurée, voir `env.moneroo.ts`). `approve-withdrawal.ts` déplace `pending_balance` vers
`withdrawn_balance` et passe la ligne de ledger à `COMPLETED` ; `reject-withdrawal.ts` restitue les
fonds à `available_balance` et passe la ligne à `REVERSED` — jamais une nouvelle ligne
compensatoire, contrairement à un remboursement de commission (rien n'a réellement quitté la
plateforme). `getBalanceHistory` (repositories/financial-transactions.ts) exclut les lignes
`REVERSED` de sa somme courante pour cette raison précise.

Vérifié en conditions réelles (script temporaire, nettoyé, solde de test entièrement retiré après
coup) : 29 assertions — garde-fous de `requestWithdrawal` (compte inactif, montant sous le minimum,
solde insuffisant, numéro invalide, ligne `PENDING_OTP` créée même quand l'envoi d'email échoue
faute de vraie clé Resend), cycle complet demande → confirmation OTP → validation admin (`PAID`,
soldes `pending`/`withdrawn` corrects) et demande → confirmation → refus admin (`REJECTED`, fonds
restitués à `available_balance`), double confirmation/double validation rejetées, motif de refus
obligatoire, exclusion des lignes `REVERSED` par `getBalanceHistory` confirmée.

## Ce qui n'est pas encore construit

- **Interface retraits** (membre et admin) : les services existent et sont vérifiés, aucune page
  ne les expose encore — voir `ARCHITECTURE.md`.
- **Réconciliation automatique** `user_balances` ↔ `financial_transactions` (cron) : identifiée
  comme besoin de Phase 11, pas construite.
