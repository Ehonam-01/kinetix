# Règles MLM

Référence métier pour la progression, le placement et les commissions. Le détail technique
(schéma, requêtes, pièges) est dans `DATABASE.md` et `ARCHITECTURE.md` ; ce document explique le
_pourquoi_ des règles, pas leur implémentation SQL.

## Les 5 niveaux

Chaque membre commence au niveau 1 et progresse indépendamment de son parrain — un filleul peut
dépasser son parrain (section 9 du prompt directeur). Un niveau se compose de générations :

| Niveau | Générations      | Total membres qualifiés |
| ------ | ---------------- | ----------------------- |
| 1      | G1=2, G2=4       | 6                       |
| 2 à 5  | G1=2, G2=4, G3=8 | 14                      |

Ces tailles sont configurables (`levels.config.generationSizes`), pas codées en dur dans le moteur.

## Un seul arbre pour les 5 niveaux

Il n'existe **pas** de structure de placement séparée par niveau. `binary_nodes` est l'unique
arbre, fixé une fois pour toutes au moment du placement (parrainage). « La génération 1 du niveau
3 de A » désigne toujours la même position physique que « la génération 1 du niveau 1 de A » — ce
qui change au fil du temps, c'est le **statut de qualification** des membres qui y sont assis, pas
leur position.

C'est la décision validée en amont (voir le rapport d'architecture) : elle a été choisie
précisément pour garantir qu'un descendant apparaisse automatiquement dans l'organisation d'un
niveau donné de son ascendant, dès que l'ascendant atteint ce niveau — même si le descendant l'a
atteint bien avant.

## Le déclencheur unique : rattrapage + propagation

Un membre « a » un niveau dès qu'une ligne `member_levels` existe pour lui à ce niveau (peu
importe si elle est `IN_PROGRESS` ou `COMPLETED`) — c'est ça, « avoir atteint » un niveau. Chaque
fois qu'un membre débloque un niveau N (`unlockLevel`), deux passes s'exécutent dans la même
transaction :

1. **Rattrapage** — scanne les positions descendantes fixes du membre (les 6 ou 14 emplacements de
   ce niveau) ; pour chaque descendant qui a _déjà_ débloqué N, incrémente immédiatement la
   génération correspondante du membre.
2. **Propagation** — scanne les ascendants fixes du membre (jusqu'à 3 générations au-dessus) ; pour
   chaque ascendant qui a _déjà_ débloqué N, incrémente sa génération correspondante.

**Exemple de référence** : B est un descendant direct de A. B débloque le niveau 2 alors que A est
encore niveau 1 — rien n'est crédité à A pour l'instant (A n'a pas encore la ligne `member_levels`
niveau 2). Des mois plus tard, A complète son niveau 1 et débloque le niveau 2 : la phase de
rattrapage de son propre déclenchement scanne ses positions descendantes, retrouve B déjà qualifié,
et l'ajoute immédiatement à sa génération 1 — sans qu'aucun replacement n'ait eu lieu, puisque la
position de B dans l'arbre n'a jamais changé.

Par construction, une paire (ascendant, descendant) ne peut déclencher l'incrémentation qu'**une
seule fois** : soit via la propagation (si l'ascendant a débloqué N avant le descendant), soit via
le rattrapage (si c'est l'inverse) — jamais les deux. `generation_progress.current_count` ne peut
donc jamais dépasser `required_count`.

## Séquentialité obligatoire

Un membre ne peut pas débloquer le niveau N sans avoir complété le niveau N-1 (sauf le niveau 1,
qui se débloque au placement). `unlockLevel` refuse explicitement de sauter un niveau — ce n'est
pas seulement une garantie applicative, c'est vérifié à l'exécution.

## Commissions

| Type                                   | Déclencheur                                             | Montant par défaut             | Bénéficiaire                         |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------ | ------------------------------------ |
| Commission directe                     | Paiement d'inscription confirmé                         | 500 F CFA                      | Le parrain direct                    |
| Bonus fin de niveau 1                  | Les 2 générations du niveau 1 sont complètes            | 1 000 F CFA                    | Le membre lui-même                   |
| Commission de génération (niveaux 2-5) | Une génération de ce niveau atteint son effectif requis | taux × taille de la génération | L'ascendant dont c'est la génération |

Les niveaux 2 à 5 paient **par génération complétée**, pas par membre individuel : compléter G1
(2 membres) au niveau 2 déclenche un paiement unique de 2 × 2 000 = 4 000 F, distinct du paiement
de G2 (4 × 2 000 = 8 000 F) plus tard. Le niveau 1 ne suit pas ce schéma : il n'y a pas de
commission par génération, seulement le bonus de 1 000 F versé une fois les deux générations
complètes.

Barème actuel (`parameter_versions`, modifiable depuis l'admin sans redéploiement) :

| Paramètre           | Clé                        | Valeur par défaut |
| ------------------- | -------------------------- | ----------------- |
| Prix inscription    | `registration_price`       | 4 500 F           |
| Commission directe  | `commission.direct`        | 500 F             |
| Bonus niveau 1      | `commission.level_1_bonus` | 1 000 F           |
| Commission niveau 2 | `commission.level.2`       | 2 000 F           |
| Commission niveau 3 | `commission.level.3`       | 3 000 F           |
| Commission niveau 4 | `commission.level.4`       | 20 000 F          |
| Commission niveau 5 | `commission.level.5`       | 50 000 F          |

## Non-rétroactivité

Chaque `commission_event` enregistre le montant déjà calculé au moment du paiement — jamais une
référence vivante vers le taux courant. Modifier `commission.level.2` demain n'affecte aucune
commission déjà versée, seulement les futures (section 29/43 du prompt directeur).

## Idempotence

Chaque commission porte une `dedupe_key` unique, dérivée déterministement de son identité :

- Bonus niveau 1 : `LEVEL_1_BONUS:{userId}`
- Commission de génération : `LEVEL_COMMISSION:{userId}:{levelCode}:{generation}`

Un second appel avec la même clé est un no-op (`ON CONFLICT DO NOTHING`) — pas une erreur, pas un
double paiement. Idem pour l'idempotence des paiements : `commission_events` a sa `dedupe_key`
(directe : `DIRECT:{sponsorId}:{beneficiaryId}`), `payment_events` la sienne pour les webhooks
(section suivante), et `payments.idempotency_key` empêche de créer deux paiements pour la même
intention.

## Paiement de l'inscription et activation

Le paiement ne rend jamais un compte actif par lui-même — seule sa **confirmation** le fait
(section 5 : ne jamais considérer une intention de paiement comme un paiement validé). Trois
méthodes convergent vers le même point d'activation unique (`activateRegistration`), qui exécute
dans une seule transaction : confirmation du paiement → profil `ACTIVE` → placement dans l'arbre
(`placeMember`, ou `createRootNode` pour le tout premier membre) → déblocage du niveau 1
(`unlockLevel`) → commission directe au parrain. Idempotent : rejouer l'activation sur un paiement
déjà confirmé ne fait rien.

| Méthode                | Qui déclenche                                  | Confirmation                                                                                                                          |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile money (Moneroo) | Le membre lui-même, depuis son tableau de bord | Webhook signé uniquement — jamais la redirection du navigateur après paiement                                                         |
| Crédit administrateur  | Un administrateur                              | Immédiate (rôle ADMIN revérifié côté serveur)                                                                                         |
| Solde interne (wallet) | Le parrain, pour un filleul qu'il parraine     | Immédiate, après vérification que le payeur est bien le parrain enregistré du bénéficiaire et que son solde disponible couvre le prix |

Le paiement par solde débite le portefeuille du parrain (`financial_transactions` type `PAYMENT`,
montant négatif) — mais le parrain reçoit tout de même sa commission directe pour ce filleul,
comme pour n'importe quelle autre méthode : la règle de commission directe ne dépend pas de qui a
payé, seulement du lien de parrainage.

## Récompenses matérielles (niveaux 3, 4, 5)

Distinctes des commissions : un membre qui complète le niveau 3 reçoit à la fois sa commission de
génération niveau 3 (versée à ses ascendants au fil de l'eau, comme toute commission de niveau) et
le téléphone (versé à lui-même). Implémenté depuis la Phase 6 : `completeLevel`
(`services/mlm/unlock-level.ts`) appelle `unlockReward` pour tout niveau ≥ 3, qui attribue à ce
membre toutes les récompenses actives de ce niveau (`rewards` → `member_rewards`).

| Niveau | Récompense (seed)      | Type       |
| ------ | ---------------------- | ---------- |
| 3      | Téléphone (200 000 F)  | `PHYSICAL` |
| 4      | Moto (700 000 F)       | `PHYSICAL` |
| 5      | Voiture (10 000 000 F) | `PHYSICAL` |

`reward_type` détermine l'impact sur le solde (déduit de la section 17 : ne jamais traiter la
valeur d'une récompense matérielle comme une commission) :

- `PHYSICAL` / `VOUCHER` / `OTHER` — ne touche jamais `user_balances` : juste une ligne
  `member_rewards` à `ELIGIBLE`, suivie manuellement (adresse de livraison, tracking) jusqu'à
  `DELIVERED`. C'est le cas des 3 récompenses ci-dessus.
- `CASH` — crédite le solde disponible exactement comme une commission (même fonction
  `creditBalance` que `commission.ts`) et écrit une ligne `financial_transactions` de type
  `REWARD`. Pas utilisé par les seeds actuelles, mais disponible si une future récompense en
  espèces est ajoutée.

Idempotent comme le reste du moteur : re-débloquer un niveau déjà récompensé ne duplique rien
(`ON CONFLICT DO NOTHING` sur `member_rewards (user_id, reward_id)`).

Cycle de vie d'une récompense : `ELIGIBLE` (attribuée) → `CLAIMED` (le membre a réclamé, via
`claimReward`, avec adresse de livraison optionnelle) → `PROCESSING` → `DELIVERED` (ces deux
dernières transitions réservées à un administrateur, via `updateRewardDeliveryStatus`, rôle
revérifié côté serveur). Aucune valeur `LOCKED` : l'absence de ligne `member_rewards` signifie déjà
verrouillé, comme pour `member_levels.status`.

## Accès aux cours (LMS) : achat obligatoire pour tous

**Décision confirmée par l'utilisateur, exécutée** (l'une des 4 décisions actées avant le début du
pivot — « achat obligatoire pour tous », voir plus bas dans ce document) : tous les cours sont
publics à parcourir, mais l'accès au contenu exige toujours un achat confirmé (ou le rôle
administrateur). Il n'existe plus de chemin d'accès gratuit par niveau MLM — avoir atteint un
niveau, même le niveau 5, ne donne plus accès à une formation par lui-même.

`hasCourseAccess`/`listCoursesForUser` (`repositories/courses.ts`) ne consultent plus jamais
`course_levels`/`member_levels` pour cette décision : uniquement une vente `sales` confirmée
(ou remboursée avec accès conservé, voir la section remboursements), ou le rôle `ADMIN`. La
création de cours n'expose plus de sélecteur de niveaux requis.

`course_levels` reste dans le schéma, inutilisée — jamais supprimée en base tant qu'aucune
décision explicite de suppression de structure n'a été prise (même discipline de migration
progressive que pour l'ancien système d'inscription payante, section « Retrait des points d'entrée
obsolètes »). L'ancien comportement (OR sur le niveau, cours public par défaut sans restriction)
est documenté ici pour mémoire, il n'est plus en vigueur.

## Transferts entre membres

Ajouté en réponse à une demande explicite (« créer la possibilité que les membres puissent
transférer les fonds d'un compte à un autre, validé par un code PIN ou OTP ») — deux décisions
produit tranchées avec l'utilisateur avant implémentation, pas devinées :

- **Validation** : OTP par email (pas de code PIN persistant, pas de SMS).
- **Destinataire** : n'importe quel membre de la plateforme, identifié par son pseudo — pas
  restreint au parrain/filleuls comme le paiement par solde (`wallet-payment.ts`).

Détail technique dans `ARCHITECTURE.md` (implémentation), `SECURITY.md` (posture OTP) et
`FINANCIAL_MODEL.md` (ledger). Règles métier propres à cette fonctionnalité, sans équivalent
ailleurs dans le prompt directeur (choix raisonnés, à reconsidérer si le besoin se précise) :

- L'émetteur **et** le destinataire doivent être `ACTIVE` — un compte encore `PENDING_PAYMENT` ne
  peut ni envoyer ni recevoir.
- Aucun montant minimum/maximum au-delà du solde disponible, aucun frais — non spécifié, donc pas
  ajouté.
- Un transfert vers soi-même est explicitement rejeté.
- Une nouvelle demande de transfert expire automatiquement toute demande `PENDING_OTP` encore
  ouverte pour le même émetteur — jamais deux codes valides simultanément pour des tentatives
  différentes.

## Pivot formation + programme ambassadeur (en cours, Phase 11)

Évolution majeure demandée par l'utilisateur : le produit principal devient la vente de
formations, pas l'inscription au réseau. Un client peut acheter et suivre des formations sans
jamais rejoindre le programme ambassadeur ; un ambassadeur rejoint gratuitement (simple opt-in,
CGU acceptées) et gagne ses commissions sur de vraies ventes attribuées, pas sur le recrutement.
Quatre décisions produit validées avec l'utilisateur avant tout code :

1. **Entrée ambassadeur gratuite** — le prix d'inscription actuel (4 500 F) cesse d'être un
   déclencheur d'activation ; toute la rémunération viendra des ventes de formations.
2. **Moteur de commission complet dès le départ** — `commission_rules`, versionné et non
   rétroactif comme `parameter_versions`, avec type `FIXED`/`PERCENTAGE`/`BV_PERCENTAGE`, plafond,
   BV minimum et condition de qualification, par formation/catégorie ou par niveau/génération.
3. **Attribution par table de tracking dédiée** — `referral_clicks`, un clic à la fois plutôt
   qu'un simple cookie, pour permettre plus tard un reporting détaillé clic → vente.
4. **Achat obligatoire pour tous** — l'accès gratuit à une formation via le niveau MLM disparaît
   au profit d'un achat individuel systématique. **Exécuté** (voir plus bas, section « Accès aux
   cours »).

**État actuel : le schéma existe, et une première brique de logique** — `joinAmbassadorProgram`
(`services/ambassador/join-program.ts`) permet de rejoindre le programme ambassadeur gratuitement :
authentification, parrain optionnel (réutilise celui déjà enregistré à l'inscription, ou
`sponsorUsername` sinon — doit être un ambassadeur `ACTIVE`), placement dans l'arbre, niveau 1
débloqué. **Aucune commission n'est versée à l'inscription au programme** — changement de règle
assumé (section 11 du prompt directeur) : la commission directe n'est plus une récompense de
recrutement, seulement une commission sur vente éligible, pas encore implémentée. Détail technique
complet dans `ARCHITECTURE.md`.

`activate-registration.ts` (l'ancien chemin, payant) continue de fonctionner exactement comme
avant, en parallèle, non modifié — aucune des règles ci-dessus dans ce document n'a changé pour ce
chemin-là. Pas encore d'interface : `join-program.ts` n'est appelable que par du code serveur,
comme `create-course.ts` avant la Phase 8.

**Décision non tranchée, à ne pas deviner** : `profiles.status = PENDING_PAYMENT` n'a plus vraiment
de sens maintenant que rejoindre le programme est gratuit (ce statut n'existait que pour bloquer
l'accès tant qu'un paiement d'inscription n'était pas confirmé) — `join-program.ts` fait passer à
`ACTIVE` le seul compte qu'il active lui-même, sans toucher à la signification générale du statut
pour un simple client qui ne rejoint jamais le programme. Cette réconciliation plus large est
repoussée à la phase qui construit vraiment le parcours client (achat de formation, tableau de bord
client) — voir le plan en 8 phases dans l'historique de conversation.

Les phases suivantes (attribution, moteur de qualification par BV, remboursements) réécriront
progressivement `unlock-level.ts`, documentées ici au fur et à mesure qu'elles sont réellement
construites — pas avant.

**Catalogue de formations vendables et achat direct construits** (`services/sales/`) : une
formation peut désormais avoir un prix et un BV réels (distincts — section 7), et n'importe quel
utilisateur authentifié peut l'acheter directement, sans jamais rejoindre le programme ambassadeur
(TEST 6 du prompt directeur). Un achat direct ne verse **aucune commission** — pas de parrain
inventé, pas de paiement improvisé. `hasCourseAccess` reconnaît maintenant un achat confirmé en
plus du niveau MLM (les deux chemins coexistent, additif). Détail technique dans `ARCHITECTURE.md`.

**Attribution et commission sur vente construites** (TEST 3/4) : chaque ambassadeur a un lien
public (`/r/{referralCode}`, son pseudo par défaut) qui pose un cookie de suivi lors d'un clic —
décision produit déjà actée : une vraie table de clics (`referral_clicks`), pas juste un cookie, et
un moteur de règles complet (`commission_rules`) plutôt que de simples taux globaux, tous deux
choisis explicitement avec l'utilisateur pour ce chantier. Un achat effectué dans la fenêtre
d'attribution (30 jours par défaut, `attribution.cookie_days`, modifiable côté admin) est attribué
à l'ambassadeur du dernier clic — même à travers plusieurs achats différents avec le même cookie
(TEST 4). La commission n'est versée que si une règle `commission_rules` s'applique réellement à
cette formation/catégorie ; en son absence, la vente reste attribuée mais ne paie rien — attribuable
et rémunéré sont deux choses distinctes. Un ambassadeur qui achète via son propre lien ne se paie
jamais lui-même : l'attribution est neutralisée, la vente aboutit normalement.

**Taux de commission sur vente directe configuré** : une règle `DIRECT_SALE` par défaut (aucune
formation/catégorie précisée, donc valable pour tout le catalogue) est désormais active — 20 % du
prix payé (`PERCENTAGE`, sans plafond), créée via `createDirectSaleCommissionRule`. Valeur exemple
raisonnable choisie par défaut (délibérément au-dessus du taux de génération 2, 10 %, pour
récompenser davantage l'effort de vente directe que le simple effet de structure) — modifiable à
tout moment côté admin, comme les 14 règles `GENERATION` déjà configurées.

**Qualification des générations : présence et/ou BV, configurable** (sections 14/16/17) — le seuil
historique (effectif complet d'une génération) reste le comportement par défaut pour tout
(niveau, génération) sans règle configurée, mais un administrateur peut désormais exiger un BV
minimum à la place, ou en plus de l'effectif. Le BV d'une vente remonte automatiquement jusqu'à 3
générations au-dessus de l'ambassadeur attribué — une même position physique compte pour plusieurs
niveaux à la fois, exactement comme pour l'effectif. Pas de rattrapage rétroactif pour le BV
(simplification assumée, voir `ARCHITECTURE.md`) : seul le BV généré après le déblocage d'un
niveau s'accumule pour lui.

**Remboursements construits** (section 22, TEST 7) : jamais une suppression, toujours une
annulation tracée. L'accès révoqué ou conservé est une vraie décision par remboursement
(`refunds.accessRevoked`), pas un simple champ journalisé. La commission directe liée à la vente
remboursée est intégralement reversée. La commission de génération, elle, ne l'est pas
automatiquement — elle dépend du BV cumulé de potentiellement plusieurs ventes, et annuler
l'intégralité de la commission à cause du remboursement d'une seule d'entre elles serait
probablement incorrect ; seul le BV de la vente remboursée est retranché du total de la génération,
sans jamais dé-compléter une génération déjà qualifiée. Limite assumée et documentée, pas un oubli.

**Dashboards séparés construits** (sections 23/24) : un simple client (sans ligne
`ambassador_profiles`) ne voit plus l'arbre MLM, les commissions, les niveaux ou les récompenses —
seulement ses cours et ses achats, avec une invitation à rejoindre le programme, gratuite. Un
ambassadeur retrouve tout, plus « Mes ventes » (les ventes attribuées à son lien, distinctes du
grand livre des commissions) et le BV désormais visible à côté de l'effectif de chaque génération.
Certificats, factures, notifications et retraits restent explicitement non construits — aucune de
ces fonctionnalités n'existe ailleurs dans le projet, aucune n'a été inventée pour combler la liste
des sections 23/24. Détail technique et limite de vérification (pas de test visuel navigateur,
faute d'identifiants) dans `ARCHITECTURE.md`.

**Ancien système d'inscription payante : points d'entrée retirés, pas la capacité elle-même.**
Aucune interface ne permet plus de déclencher un nouveau paiement d'inscription ou un crédit
administrateur — la commission `DIRECT` que ce chemin versait à l'inscription contredisait
directement la règle validée en section 11 (la commission directe vient d'une vente, jamais du
recrutement) ; retirer le bouton « Créditer » ferme cette boucle pour de bon. Les services
sous-jacents (`activate-registration.ts`, le webhook Moneroo) restent intacts pour ne jamais
casser un paiement déjà engagé avant ce retrait, et aucune donnée historique n'est touchée.
`PENDING_PAYMENT` prend enfin un sens stable : un client qui n'a pas rejoint le programme
ambassadeur — plus une inscription en attente. Un administrateur peut désormais suspendre un tel
compte comme n'importe quel autre (l'ancien garde-fou qui l'en empêchait était une hypothèse de
l'ancien modèle, pas une règle métier).

**Paramètres devenus orphelins, supprimés pour de bon (post-Phase 11)** : `registration_price`,
`commission.direct` et `commission.level.2` à `.level.5` ne sont plus lus par aucun chemin de code
réellement atteignable — confirmé avant suppression, pas supposé : aucune interface n'appelle plus
`grantAdminCredit`/`payRegistrationFromWallet`/`initiateRegistrationPayment`
(`services/payments/*.ts`, toujours présents en tant que code mort, non supprimés), l'unique
paiement `REGISTRATION` en base est déjà `CONFIRMED` (un rejeu serait un no-op), et les 14 règles
`commission_rules` de génération couvrent désormais chaque (niveau, génération), rendant
l'ancienne branche de repli à taux fixe de `unlock-level.ts` définitivement inatteignable.
Contrairement à `commission_rules`/`parameter_versions` d'habitude (jamais réécrit, seulement
fermé via `effective_to`), ces lignes ont été supprimées pour de bon plutôt que closes — décision
explicite de l'utilisateur, aucune commission réelle n'ayant jamais dépendu d'elles
(`commission_events` à zéro ligne). `commission.level_1_bonus` (1000 F) reste actif : contrairement
aux autres, `completeLevel` le lit sans condition dès qu'un membre complète son niveau 1, aussi
bien via l'ancien flux payant que via le nouvel accès gratuit au programme.

**Le pivot est terminé** — les 8 phases validées avec l'utilisateur sont toutes construites et
vérifiées en conditions réelles. Détail phase par phase dans `ARCHITECTURE.md`.
