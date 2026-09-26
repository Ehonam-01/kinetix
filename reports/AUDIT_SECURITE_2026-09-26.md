# Audit de sécurité — Kinetix Africa

**Date :** 26 septembre 2026
**Commit audité :** `e04718d` (branche `main`)
**Stack :** Next.js 16.3.0 (App Router, Server Actions), React 19.2, TypeScript, Drizzle ORM + Postgres (Supabase), Supabase Auth/Storage, Vercel (cron), PayDunya / Bictorys / Moneroo, Resend, Anthropic.

---

## Suivi des correctifs (mis à jour le 26/09/2026)

| ID | Statut | Détail |
|---|---|---|
| C1 | ✅ Corrigé | `next@16.3.6` + `eslint-config-next@16.3.6` (épinglés). `npm audit fix` : 0 vulnérabilité en production. |
| H1 | ✅ Corrigé | `transactionId`/téléphone Wizall stockés dans `payments.metadata` côté serveur. L'action n'accepte que `paymentId` + code, vérifie prestataire, statut et propriétaire, puis revérifie via `verifyPayment` (statut + montant). |
| H2 | ✅ Corrigé | Tentative consommée atomiquement avant la comparaison, dans les 5 flux OTP. |
| H3 | ✅ Corrigé | Seul le propriétaire du wallet peut saisir le code. Nouvelle section « Demandes de paiement en attente » sur `/dashboard/transfer`. 3 demandes par heure et par wallet. Délai de 30 min pour un wallet tiers. Nouvel email. |
| H4 | ✅ Corrigé | Réservation atomique avant le virement. Refus Bictorys 4xx → retour en file. Erreur ambiguë → reste « en cours » avec un avertissement visible par l'admin. |
| H5 | ✅ Corrigé (code) | IPN revérifiée via l'API (statut + montant). Hash retiré de `raw_payload`. **Reste à faire manuellement** : purge SQL des hashes déjà stockés et, si nécessaire, rotation des clés PayDunya. |
| M4 | ✅ Corrigé | `escapeHtml` appliqué à tous les emails qui interpolent des données membre. |
| M7 | ✅ Corrigé | Montant comparé au polling, au webhook PayDunya et à la confirmation Wizall (`verifyPayment` PayDunya normalisé avec `Number()`). |
| M1 | ✅ Corrigé | `X-Frame-Options`, CSP `frame-ancestors/base-uri/object-src`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS (sans `includeSubDomains`). Vérifié avec `curl -I`. |
| M3 | ✅ Corrigé | `user_metadata` revalidé avec les schémas de l'inscription. `sponsor_id` validé (UUID, membre existant non supprimé, pas soi-même). |
| M5 | ✅ Corrigé (dépôt) | Migration `0054_enforce_rls_and_revoke.sql` + `SECURITY.md` corrigé. **À appliquer** : `npm run db:migrate` (sans effet sur les données). |
| M6 | ✅ Corrigé | Mot de passe actuel exigé (ré-authentification). Longueur minimale inchangée (8), à relever avec le réglage Supabase si tu le souhaites. |
| M8 | ✅ Corrigé | Messages génériques : login, webhooks, Bictorys, Moneroo, Resend. Détails conservés dans les logs serveur. |
| L1 | ✅ Corrigé | `getTrustedOrigin()` : `SITE_URL` en production, origine de la requête en dev local et sur les previews Vercel. |
| L2 | ✅ Corrigé | `timingSafeEqual` sur le secret du cron. |
| L3 | ✅ Corrigé (partiel) | Code et `course` validés avant tout accès à la base. Le rate limiting dépend de H6. |
| L5 | ✅ Corrigé (partiel) | Réponses bornées (UUID, 200 maximum). L'affichage de la correction après un échec est conservé (choix pédagogique). |
| L6 | ✅ Corrigé | Cookies de session forcés `HttpOnly`/`Secure`/`SameSite=Lax`. Client navigateur Supabase (inutilisé) supprimé. |
| Autres | ⏳ À faire | H6 (nécessite Upstash), M2 (décision produit sur les retraits des membres gelés), L4 (dépend de H6), L7 (SQL Storage), L8 (Zod sur les actions admin). |
| L9 | ✅ Sans objet | `npm audit fix` a corrigé les sous-dépendances. `shadcn` reste en `dependencies` : `globals.css` l'importe au build, et le déplacer casserait un `npm ci --omit=dev`. |

---

## 0. Méthode et limites

**Ce qui a été fait :**

- Revue manuelle du code : 100 % des Server Actions (`"use server"`), des Route Handlers (`app/api/**`, `app/auth/callback`, `app/r/[code]`), du proxy, des gardes d'authentification, de tous les services financiers (paiements, webhooks, wallet, retraits, recharges, OTP) et des migrations SQL.
- Recherche systématique des sinks dangereux : `dangerouslySetInnerHTML`, `eval`, `Function`, `child_process`, `sql.raw`, concaténations SQL, `fetch` sortants, `localStorage`, en-têtes.
- **Vérification en lecture seule de la base de production** (transaction `READ ONLY`) : état RLS réel de chaque table, privilèges des rôles `anon`/`authenticated`, buckets et politiques Storage, fonctions `SECURITY DEFINER`.
- **Sonde REST en lecture seule** (`GET /rest/v1/<table>?select=id&limit=1`) avec la clé anon publique, sur 8 tables sensibles.
- `npm audit` (production et complet), plus un scan de l'historique git à la recherche de secrets.
- Contrôle de la documentation Next.js 16 embarquée (`node_modules/next/dist/docs`) sur l'autorisation dans les layouts.

**Ce qui n'a PAS pu être vérifié (à contrôler manuellement) :**

- Les réglages du dashboard Supabase Auth : confirmation d'email, rate limits, protection contre les mots de passe compromis, « Secure password change », durée du JWT, liste blanche des URL de redirection, MFA.
- La configuration Vercel (en-têtes par défaut, protection DDoS/WAF, variables d'environnement effectivement définies) et l'hébergement réel (Vercel seul ou aussi Coolify).
- Le comportement réel des API PayDunya (endpoint Wizall `confirm`, format de l'IPN) et Bictorys (clé d'idempotence des payouts). Aucun appel n'a été fait vers les prestataires de paiement.
- Aucun test dynamique (pentest actif) n'a été mené contre l'application déployée.

---

## 1. Synthèse

### Score global : **58 / 100**

L'architecture de sécurité de base est **solide et au-dessus de la moyenne**. Chaque Server Action revérifie la session et le rôle côté serveur. Toutes les requêtes SQL sont paramétrées. Il n'y a aucun sink XSS avec des données utilisateur. Les écritures financières sont idempotentes et les débits sont protégés par des `UPDATE ... WHERE balance >= x`. En production, la RLS est effectivement active partout et aucun privilège de données n'est accordé aux rôles `anon`/`authenticated`.

Le score est tiré vers le bas par quatre groupes de problèmes :

- une dépendance critique non patchée (Next.js) ;
- plusieurs **failles logiques dans les flux d'argent** : confirmation Wizall pilotée par le client, compteur d'OTP non atomique, wallet d'un tiers ciblable, double virement possible ;
- l'**absence totale de rate limiting** ;
- l'**absence d'en-têtes de sécurité HTTP**.

### Répartition

| Gravité | Nombre |
|---|---|
| 🔴 Critique | 1 |
| 🟠 Élevée | 6 |
| 🟡 Moyenne | 8 |
| 🔵 Faible | 9 |
| **Total** | **24** |

---

## 2. Tableau récapitulatif

| ID | Gravité | Titre | Fichier principal |
|---|---|---|---|
| C1 | 🔴 Critique | Next.js 16.3.0 vulnérable à deux RCE publiques | `package.json` |
| H1 | 🟠 Élevée | Confirmation Wizall pilotée par des données client, sans vérification prestataire | `src/app/dashboard/subscription/actions.ts:95` |
| H2 | 🟠 Élevée | Compteur de tentatives OTP non atomique (brute-force par requêtes concurrentes) | `src/services/wallet/confirm-transfer.ts:48` (+4 fichiers) |
| H3 | 🟠 Élevée | Paiement d'abonnement via le wallet d'un tiers : l'attaquant saisit l'OTP du wallet visé | `src/services/subscriptions/confirm-subscription-wallet.ts:31` |
| H4 | 🟠 Élevée | Double virement réel possible à l'approbation d'un retrait | `src/services/admin/approve-withdrawal.ts:54` |
| H5 | 🟠 Élevée | IPN PayDunya authentifiée par un hash constant, jamais revérifiée auprès de l'API | `src/app/api/webhooks/providers/paydunya/route.ts` |
| H6 | 🟠 Élevée | Aucun rate limiting (login, inscription, reset, OTP, lookups, liens de parrainage) | global |
| M1 | 🟡 Moyenne | Aucun en-tête de sécurité HTTP (clickjacking, CSP, nosniff…) | `next.config.ts` |
| M2 | 🟡 Moyenne | Gel d'abonnement appliqué seulement dans le layout (contournable) | `src/app/dashboard/layout.tsx:72` |
| M3 | 🟡 Moyenne | Métadonnées d'inscription Supabase utilisées sans validation | `src/services/auth/ensure-profile.ts`, `src/app/auth/callback/route.ts` |
| M4 | 🟡 Moyenne | Injection HTML dans les emails transactionnels | 6 services d'email |
| M5 | 🟡 Moyenne | Migrations sans RLS sur 17 tables + privilèges résiduels (`TRUNCATE`…) | `src/db/migrations/*` |
| M6 | 🟡 Moyenne | Changement de mot de passe sans ré-authentification, politique faible | `src/app/dashboard/settings/actions.ts:51` |
| M7 | 🟡 Moyenne | Montant jamais comparé lors des confirmations de paiement | `src/app/dashboard/subscription/actions.ts:151` |
| M8 | 🟡 Moyenne | Fuite de messages d'erreur internes (prestataires, Zod, Supabase) | `src/services/payments/bictorys.ts:81`, routes webhook |
| L1 | 🔵 Faible | URL de redirection construites depuis l'en-tête `Origin` | 3 fichiers |
| L2 | 🔵 Faible | Comparaison du `CRON_SECRET` non constante en temps | `src/app/api/cron/subscription-reminders/route.ts:11` |
| L3 | 🔵 Faible | `/r/[code]` : écriture DB anonyme illimitée, paramètres non validés | `src/app/r/[code]/route.ts` |
| L4 | 🔵 Faible | Énumération pseudo → nom complet sans authentification | `src/app/(auth)/register/actions.ts:14` |
| L5 | 🔵 Faible | Réponses du quiz divulguées même en cas d'échec | `src/services/lms/submit-quiz-attempt.ts:62` |
| L6 | 🔵 Faible | Cookies de session Supabase non `HttpOnly` | `src/proxy.ts`, `src/lib/supabase/server.ts` |
| L7 | 🔵 Faible | Buckets Storage sans limite de taille ni de type MIME | Supabase Storage |
| L8 | 🔵 Faible | Entrées admin validées seulement par les types TypeScript | `src/app/admin/**/actions.ts` |
| L9 | 🔵 Faible | Dépendances vulnérables secondaires, `shadcn` en dépendance de production | `package.json` |

---

## 3. Détail des vulnérabilités et correctifs

### 🔴 C1 — Next.js 16.3.0 vulnérable à deux RCE publiques

**Fichier :** `package.json` (`"next": "16.3.0"`)

**Constat (`npm audit --omit=dev`) :**
```
next  16.0.0 - 16.3.2   Severity: critical
- GHSA-2xp9-vwfh-vxw4  Unauthenticated RCE in Image Optimization API when AVIF files are used
- GHSA-p293-qw3h-jr36  Unauthenticated RCE on windows-hosted servers
```

**Pourquoi c'est dangereux :** l'application utilise `next/image` (`hero-section.tsx`, `final-cta.tsx`, `logo.tsx`, `media-slot.tsx`), donc l'endpoint `/_next/image` est actif. Une exécution de code à distance non authentifiée donne un accès complet au serveur. Cela inclut `DATABASE_URL` (connexion Postgres qui contourne la RLS), `SUPABASE_SERVICE_ROLE_KEY` et les clés de paiement. Le second avis concerne les serveurs Windows : ton poste de dev est exposé sur le LAN (`allowedDevOrigins: ["192.168.1.69"]`).

**⚠️ Incertitude :** sur Vercel, l'optimisation d'image est exécutée par l'infrastructure Vercel. Je ne peux pas confirmer si elle est affectée. Sur un hébergement Node autonome (Coolify), elle l'est. Il faut patcher dans tous les cas.

**Correctif :**
```bash
npm install next@16.3.6 eslint-config-next@16.3.6
npm run build && npm test
```
En attendant le déploiement du patch, tu peux désactiver l'optimiseur :
```ts
// next.config.ts
images: { unoptimized: true },
```

---

### 🟠 H1 — Confirmation Wizall pilotée par des données client

**Fichier :** `src/app/dashboard/subscription/actions.ts:95-125`

**Code vulnérable :**
```ts
export async function confirmWizallPaymentAction(
  paymentId: string,
  transactionId: string,   // ← fourni par le client
  phone: string,           // ← fourni par le client
  authorizationCode: string,
) {
  const { profile } = await requireUser();
  const payment = await findPaymentById(db, paymentId);
  if (!payment || payment.beneficiaryUserId !== profile.id) { ... }
  await confirmWizallPayment(transactionId, phone, authorizationCode);
  await db.transaction((tx) =>
    processWebhookEvent(tx, { providerReference: payment.providerReference ?? paymentId,
      status: "CONFIRMED", ... }));   // ← CONFIRMED sans aucune vérification
}
```

**Risque :** l'action marque comme `CONFIRMED` **n'importe quel** paiement de l'utilisateur, quels que soient son prestataire et son statut. Il suffit que PayDunya accepte un `transactionId` que **le client choisit librement**. Rien ne lie ce `transactionId` au paiement ciblé, et rien ne vérifie auprès de PayDunya que la facture correspondante est payée ni que le montant est correct.

Scénario : un paiement Wizall légitime est confirmé une fois. L'attaquant ouvre ensuite d'autres paiements `PENDING`, par exemple via Bictorys, et appelle l'action avec l'ancien `transactionId` et l'ancien code. Si l'endpoint PayDunya répond `success` à nouveau, chaque paiement débloque un abonnement, déclenche la commission `DIRECT_SALE` et propage du volume.

**⚠️ Non vérifié :** la réponse de PayDunya à un rejeu. Mais la conception est vulnérable indépendamment de ce détail : elle fait confiance au client.

**Correctif :**

1. Stocker le `transactionId` et le téléphone **côté serveur** au moment de la création du paiement :
```ts
// src/services/subscriptions/initiate-subscription-payment.ts (remplace l'update final)
const [payment] = await db
  .update(payments)
  .set({
    providerReference: intent.providerReference,
    ...(intent.pendingWizallConfirmation && {
      metadata: {
        ...((pendingPayment.metadata as Record<string, unknown> | null) ?? {}),
        wizallTransactionId: intent.pendingWizallConfirmation.transactionId,
        wizallPhone: input.phone,
      },
    }),
  })
  .where(eq(payments.id, pendingPayment.id))
  .returning();
```

2. N'accepter du client que `paymentId` et le code, et revérifier auprès de PayDunya :
```ts
// src/app/dashboard/subscription/actions.ts
import { z } from "zod";
import { paydunyaProvider, confirmWizallPayment } from "@/services/payments/paydunya";

const wizallCodeSchema = z.string().trim().regex(/^\d{4,8}$/);

export async function confirmWizallPaymentAction(
  paymentId: string,
  authorizationCode: string,
) {
  const { profile } = await requireUser();
  const code = wizallCodeSchema.safeParse(authorizationCode);
  if (!code.success) return { error: "Code d'autorisation invalide." };

  const payment = await findPaymentById(db, paymentId);
  const metadata = payment?.metadata as
    | { wizallTransactionId?: string; wizallPhone?: string }
    | null;
  const providerReference = payment?.providerReference;
  if (
    !payment ||
    payment.beneficiaryUserId !== profile.id ||
    payment.provider !== "PAYDUNYA" ||
    payment.status !== "PENDING" ||
    !providerReference ||
    !metadata?.wizallTransactionId ||
    !metadata.wizallPhone
  ) {
    return { error: "Paiement introuvable." };
  }

  try {
    await confirmWizallPayment(
      metadata.wizallTransactionId,
      metadata.wizallPhone,
      code.data,
    );
  } catch {
    return { error: "Le code n'a pas été accepté par l'opérateur." };
  }

  // Jamais un CONFIRMED « déclaré » : on relit l'état réel de la facture.
  const verified = await paydunyaProvider.verifyPayment(providerReference);
  if (verified.status !== "CONFIRMED") {
    return { error: "Paiement pas encore confirmé, réessayez dans un instant." };
  }
  if (verified.amount !== payment.amount) {
    console.error("Wizall : montant incohérent", { paymentId, expected: payment.amount, got: verified.amount });
    return { error: "Montant incohérent, contactez le support." };
  }

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference,
      status: "CONFIRMED",
      eventType: "wizall-verified",
      dedupeKey: `poll-reconcile:${payment.id}:CONFIRMED`,
      raw: { verifiedAmount: verified.amount },
    }),
  );
  return { error: null };
}
```

3. Adapter `paydunya-subscribe-form.tsx:142` pour appeler `confirmWizallPaymentAction(paymentId, wizallCode.trim())`. `subscribeAction` n'a alors plus besoin de renvoyer le `transactionId` au navigateur.

---

### 🟠 H2 — Compteur de tentatives OTP non atomique

**Fichiers (même motif) :**
- `src/services/wallet/confirm-transfer.ts:48-64`
- `src/services/wallet/confirm-withdrawal.ts:43-59`
- `src/services/subscriptions/confirm-subscription-wallet.ts:48-66`
- `src/services/account/confirm-account-deletion.ts:43-57`
- `src/services/admin/confirm-recharge.ts:35-49`

**Code vulnérable :**
```ts
const transfer = await db.query.walletTransfers.findFirst(...);   // lecture
if (transfer.otpAttempts >= MAX_OTP_ATTEMPTS) { ... }             // test
if (!verifyOtpCode(code, transfer.otpCodeHash)) {
  await db.update(walletTransfers)
    .set({ otpAttempts: sql`${walletTransfers.otpAttempts} + 1` }) // incrément APRÈS
  ...
}
```

**Risque :** c'est un TOCTOU (course entre la vérification et l'usage). N requêtes envoyées en parallèle lisent toutes `otpAttempts = 0`, passent le test, puis vérifient chacune un code différent. Le plafond de 5 tentatives ne tient donc que pour des requêtes séquentielles. Avec quelques milliers de requêtes concurrentes par code, pendant 5 minutes et sans aucun rate limiting (H6), l'espace de 10⁶ codes devient attaquable, surtout que la génération de nouveaux codes est illimitée. Couplé à H3, cela permet de vider le wallet d'un autre membre.

**Correctif :** consommer la tentative **atomiquement, avant** de comparer le code. Exemple pour `confirmTransfer`, à reproduire dans les 4 autres :
```ts
import { and, eq, gt, lt, sql } from "drizzle-orm";

export async function confirmTransfer(senderId: string, transferId: string, code: string) {
  // 1. Une tentative est « brûlée » en base avant toute comparaison :
  //    N requêtes concurrentes ne peuvent jamais dépasser MAX_OTP_ATTEMPTS.
  const [transfer] = await db
    .update(walletTransfers)
    .set({ otpAttempts: sql`${walletTransfers.otpAttempts} + 1` })
    .where(
      and(
        eq(walletTransfers.id, transferId),
        eq(walletTransfers.senderId, senderId),
        eq(walletTransfers.status, "PENDING_OTP"),
        lt(walletTransfers.otpAttempts, MAX_OTP_ATTEMPTS),
        gt(walletTransfers.otpExpiresAt, sql`now()`),
      ),
    )
    .returning();

  if (!transfer) {
    await db
      .update(walletTransfers)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(walletTransfers.id, transferId),
          eq(walletTransfers.senderId, senderId),
          eq(walletTransfers.status, "PENDING_OTP"),
        ),
      );
    throw new Error("Code expiré, déjà utilisé ou trop de tentatives. Veuillez recommencer.");
  }

  if (!verifyOtpCode(code, transfer.otpCodeHash)) {
    throw new Error("Code incorrect.");
  }

  // 2. Transaction de mouvement d'argent : inchangée.
  return db.transaction(async (tx) => { /* ...code existant... */ });
}
```
Ajoute aussi un rate limit par utilisateur sur les confirmations OTP (voir H6), par exemple 10 par 15 minutes.

---

### 🟠 H3 — Wallet d'un tiers : l'attaquant saisit lui-même l'OTP du wallet visé

**Fichiers :**
- `src/services/subscriptions/request-subscription-wallet.ts:35-118`
- `src/services/subscriptions/confirm-subscription-wallet.ts:31-37`

**Code vulnérable :**
```ts
// request : l'acheteur désigne N'IMPORTE QUEL wallet par pseudo
const wallet = await findProfileByUsername(input.walletUsername);
// ... OTP envoyé au propriétaire du wallet
// confirm : l'acheteur OU le propriétaire peut saisir le code
if (!request || (request.buyerUserId !== callerUserId && request.walletUserId !== callerUserId))
```

**Risque :** depuis son propre compte, un attaquant peut :
1. **Brute-forcer** l'OTP du wallet d'une victime (voir H2). Chaque nouvelle demande génère un nouveau code et il n'y a aucune limite ;
2. faire du **phishing** : la victime reçoit un email légitime de la plateforme qui contient un code, et l'attaquant lui demande de le lui communiquer par un autre canal ;
3. faire du **spam d'emails** vers n'importe quel membre.

L'argent sort du wallet de la victime.

**Correctif :** quand le wallet appartient à un tiers, **seul son propriétaire** doit pouvoir confirmer, depuis sa propre session. Il faut aussi limiter les demandes par wallet.
```ts
// confirm-subscription-wallet.ts
const request = await db.query.subscriptionWalletRequests.findFirst({
  where: eq(subscriptionWalletRequests.id, requestId),
});
const isThirdPartyWallet = request && request.walletUserId !== request.buyerUserId;
const allowedCaller = isThirdPartyWallet ? request.walletUserId : request?.buyerUserId;
if (!request || callerUserId !== allowedCaller) {
  throw new Error("Demande de souscription introuvable.");
}
// + consommation atomique de tentative (H2)
```
```ts
// request-subscription-wallet.ts, avant la génération du code
import { and, eq, gt, sql } from "drizzle-orm";

const recentRequests = await db.$count(
  subscriptionWalletRequests,
  and(
    eq(subscriptionWalletRequests.walletUserId, wallet.id),
    gt(subscriptionWalletRequests.createdAt, sql`now() - interval '1 hour'`),
  ),
);
if (recentRequests >= 3) {
  throw new Error("Trop de demandes de paiement vers ce wallet. Réessayez plus tard.");
}
```
Côté interface, ajoute une section « Demandes de paiement en attente » dans le dashboard du propriétaire du wallet, avec le champ OTP. L'email devient alors : « Connectez-vous à votre espace pour valider. Ne communiquez **jamais** ce code à qui que ce soit. »

---

### 🟠 H4 — Double virement réel à l'approbation d'un retrait

**Fichier :** `src/services/admin/approve-withdrawal.ts:51-82`

**Code vulnérable :**
```ts
if (request.status !== "PENDING_REVIEW") { throw ... }   // lecture non verrouillée
const payout = await createBictorysPayout({...});        // ← argent envoyé ICI
return db.transaction(async (tx) => {
  const [updated] = await tx.update(withdrawalRequests)
    .set({ status: "PROCESSING", ... })
    .where(and(eq(id), eq(status, "PENDING_REVIEW")))   // ← verrou APRÈS le virement
```

**Risque :** un double-clic, deux onglets ou deux administrateurs agissant en même temps provoquent **deux virements Bictorys réels**. Le second échoue seulement après l'envoi de l'argent (le code l'admet dans son message d'erreur). Le payout ne transmet pas non plus de clé d'idempotence au prestataire.

**Correctif :** verrouiller d'abord, virer ensuite.
```ts
import { and, eq, isNull, sql } from "drizzle-orm";

export async function approveWithdrawal(adminUserId: string, requestId: string) {
  const admin = await db.query.profiles.findFirst({ where: eq(profiles.id, adminUserId) });
  if (admin?.role !== "ADMIN") throw new Error("Seul un administrateur peut valider un retrait.");

  // 1. Réservation atomique : un seul appelant peut passer PENDING_REVIEW -> PROCESSING.
  const [claimed] = await db
    .update(withdrawalRequests)
    .set({ status: "PROCESSING", reviewedBy: adminUserId, reviewedAt: sql`now()` })
    .where(and(eq(withdrawalRequests.id, requestId), eq(withdrawalRequests.status, "PENDING_REVIEW")))
    .returning();
  if (!claimed) throw new Error("Cette demande n'est plus en attente de validation.");
  if (!claimed.operator || !claimed.country) {
    await db.update(withdrawalRequests)
      .set({ status: "PENDING_REVIEW", reviewedBy: null, reviewedAt: null })
      .where(eq(withdrawalRequests.id, requestId));
    throw new Error("Opérateur/pays manquant : paiement manuel requis.");
  }

  const recipient = await db.query.profiles.findFirst({ where: eq(profiles.id, claimed.userId) });

  // 2. Virement réel, seulement une fois la demande réservée.
  let payout;
  try {
    payout = await createBictorysPayout({
      amount: claimed.amount,
      phone: claimed.payoutPhone,
      operator: claimed.operator,
      country: claimed.country,
      recipientName: recipient?.fullName ?? "",
    });
  } catch (err) {
    // Échec franc : retour en file. Sur un timeout ou une erreur 5xx, il vaut
    // mieux NE PAS rétrograder automatiquement (le virement a pu partir)
    // et laisser un admin réconcilier via le tableau de bord Bictorys.
    await db.update(withdrawalRequests)
      .set({
        status: "PENDING_REVIEW",
        reviewedBy: null,
        reviewedAt: null,
        payoutFailureReason: err instanceof Error ? err.message : "Échec du virement.",
      })
      .where(and(
        eq(withdrawalRequests.id, requestId),
        eq(withdrawalRequests.status, "PROCESSING"),
        isNull(withdrawalRequests.payoutProviderReference),
      ));
    throw err;
  }

  return db.transaction(async (tx) => {
    const [updated] = await tx.update(withdrawalRequests)
      .set({ payoutProviderReference: payout.payoutProviderReference })
      .where(eq(withdrawalRequests.id, requestId))
      .returning();
    await logAdminAction(tx, { /* ...inchangé... */ });
    return updated;
  });
}
```
**À vérifier :** si Bictorys accepte une référence marchand ou une clé d'idempotence sur `createpayout`, passe `requestId`. Un rejeu serait alors refusé côté prestataire, et le webhook pourrait retrouver la demande même s'il arrive avant l'enregistrement de `payoutProviderReference`.

---

### 🟠 H5 — IPN PayDunya : hash constant, aucune revérification auprès de l'API

**Fichiers :**
- `src/services/payments/paydunya.ts:511-562`
- `src/app/api/webhooks/providers/paydunya/route.ts:14-30`

**Code vulnérable :**
```ts
// Le « hash » vaut SHA-512(masterKey) : c'est la même valeur pour TOUS les callbacks.
const expected = createHash("sha512").update(getPaydunyaEnv().PAYDUNYA_MASTER_KEY).digest("hex");
...
return { ..., status: toPaymentStatus(event.status), raw: payload };  // raw contient le hash
```
```ts
// route.ts : on fait confiance au statut de l'IPN
await db.transaction((tx) => processWebhookEvent(tx, event));
```

**Risque :** ce hash n'authentifie pas le **contenu** du message. C'est un secret statique et perpétuel. De plus, il est **stocké en clair** dans `payment_events.raw_payload` à chaque IPN. Toute personne qui obtient une seule IPN (lecture de la base, sauvegarde, logs, écran admin, fuite chez un tiers) peut forger indéfiniment des IPN `completed` pour n'importe quel `token`. Le résultat : des abonnements gratuits, des commissions indues, puis des retraits. Le montant n'est jamais contrôlé non plus.

**Correctif :** ne jamais faire confiance au contenu de l'IPN, seulement à l'API.
```ts
// src/app/api/webhooks/providers/paydunya/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { findPaymentByProviderReference } from "@/repositories/payments";
import { processWebhookEvent } from "@/services/payments/process-webhook-event";
import { paydunyaProvider } from "@/services/payments/paydunya";

export async function POST(request: Request) {
  const rawBody = await request.text();

  let event;
  try {
    event = paydunyaProvider.parseWebhook(rawBody, null);
  } catch (error) {
    console.warn("Webhook PayDunya rejeté :", (error as Error).message);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  const payment = await findPaymentByProviderReference(db, event.providerReference);
  if (!payment) return NextResponse.json({ received: true });

  // L'IPN n'est qu'un signal : la source de vérité est l'API de confirmation.
  const verified = await paydunyaProvider.verifyPayment(event.providerReference);
  if (verified.status === "PENDING") return NextResponse.json({ received: true });
  if (verified.status === "CONFIRMED" && verified.amount !== payment.amount) {
    console.error("PayDunya : montant incohérent", {
      paymentId: payment.id, expected: payment.amount, got: verified.amount,
    });
    return NextResponse.json({ received: true });
  }

  await db.transaction((tx) =>
    processWebhookEvent(tx, {
      providerReference: event.providerReference,
      status: verified.status,
      eventType: `ipn-verified:${verified.status}`,
      dedupeKey: `${event.providerReference}:${verified.status}`,
      raw: event.raw,
    }),
  );
  return NextResponse.json({ received: true });
}
```
```ts
// src/services/payments/paydunya.ts, dans parseWebhook, avant le return
const safePayload: Record<string, unknown> = { ...payload };
delete safePayload.hash; // ne jamais persister le secret
return { ..., raw: safePayload };
```
Purge des hashes déjà stockés :
```sql
UPDATE payment_events SET raw_payload = raw_payload - 'hash' WHERE raw_payload ? 'hash';
```
**Si `payment_events` a déjà pu être exposée** (sauvegardes, accès tiers), **régénère les clés PayDunya**. C'est le seul moyen d'invalider le hash.

---

### 🟠 H6 — Aucun rate limiting

**Surfaces concernées :**

| Surface | Fichier | Risque |
|---|---|---|
| Login | `src/app/(auth)/login/actions.ts` | brute-force, credential stuffing |
| Inscription | `src/app/(auth)/register/actions.ts` | création de comptes en masse |
| Mot de passe oublié | `src/app/(auth)/forgot-password/actions.ts` | email bombing |
| Demandes d'OTP (transfert, retrait, wallet, suppression) | `services/wallet/*`, `services/subscriptions/*`, `services/account/*` | spam d'emails, coût Resend, H2/H3 |
| Confirmations d'OTP | 5 services | brute-force (H2) |
| `lookupSponsorAction` (sans auth) | `register/actions.ts:14` | énumération (L4) |
| `/r/[code]` (sans auth) | `app/r/[code]/route.ts` | saturation de `referral_clicks` (L3) |
| Recherche réseau (`ILIKE`) | `repositories/binary-nodes.ts` | coût DB |

`SECURITY.md` reconnaît déjà ce manque. Point aggravant : l'authentification Supabase est appelée **depuis le serveur**. Les limites par IP de Supabase voient donc l'IP de Vercel, pas celle de l'attaquant. Elles deviennent soit inefficaces, soit un moyen de bloquer tous les utilisateurs en même temps (**à vérifier** dans le dashboard Supabase > Auth > Rate Limits).

**Correctif** (Upstash Redis, compatible serverless Vercel) :
```bash
npm install @upstash/ratelimit @upstash/redis
# Variables : UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
```
```ts
// src/lib/rate-limit.ts
import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

const redis = Redis.fromEnv();

const limiters = {
  login: new Ratelimit({ redis, prefix: "rl:login", limiter: Ratelimit.slidingWindow(5, "15 m") }),
  signup: new Ratelimit({ redis, prefix: "rl:signup", limiter: Ratelimit.slidingWindow(5, "1 h") }),
  passwordReset: new Ratelimit({ redis, prefix: "rl:reset", limiter: Ratelimit.slidingWindow(3, "1 h") }),
  otpRequest: new Ratelimit({ redis, prefix: "rl:otp-req", limiter: Ratelimit.slidingWindow(5, "1 h") }),
  otpConfirm: new Ratelimit({ redis, prefix: "rl:otp-ok", limiter: Ratelimit.slidingWindow(10, "15 m") }),
  lookup: new Ratelimit({ redis, prefix: "rl:lookup", limiter: Ratelimit.slidingWindow(30, "1 m") }),
  referralClick: new Ratelimit({ redis, prefix: "rl:ref", limiter: Ratelimit.slidingWindow(20, "1 m") }),
} as const;

export type RateLimitKind = keyof typeof limiters;

// Sur Vercel, x-forwarded-for est posé par la plateforme (fiable). Derrière
// un autre proxy (Coolify/Traefik), vérifier qu'il écrase bien cet en-tête.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function isRateLimited(kind: RateLimitKind, key: string): Promise<boolean> {
  const { success } = await limiters[kind].limit(key);
  return !success;
}

export const RATE_LIMIT_MESSAGE = "Trop de tentatives. Veuillez patienter avant de réessayer.";
```
```ts
// src/app/(auth)/login/actions.ts
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

export async function loginAction(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides" };

  const ip = await getClientIp();
  const email = parsed.data.email.toLowerCase();
  if ((await isRateLimited("login", `ip:${ip}`)) || (await isRateLimited("login", `email:${email}`))) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const { error } = await loginUser(parsed.data);
  if (error) return { error: "Email ou mot de passe incorrect." }; // voir M8
  redirect("/dashboard");
}
```
Applique le même motif :
- `signup` et `passwordReset` : par IP ;
- `otpRequest` et `otpConfirm` : par `profile.id` ;
- `lookup` : par IP, ou par `profile.id` quand l'utilisateur est connecté ;
- `referralClick` : par IP.

---

### 🟡 M1 — Aucun en-tête de sécurité HTTP

**Fichiers :** `next.config.ts`, `vercel.json` (aucune directive `headers`)

**Risque :**
- **Clickjacking** : les pages de transfert, de retrait et d'administration peuvent être intégrées dans une iframe par un site tiers ;
- pas de CSP pour limiter l'impact d'une éventuelle XSS ;
- pas de `nosniff` ;
- le `Referer` peut fuiter des URL internes.

**Correctif :**
```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // ...existant
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
```
Étape suivante : une CSP complète (`script-src` avec nonce, voir `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Déploie-la d'abord en `Content-Security-Policy-Report-Only`, car le script de thème inline (`app/layout.tsx`) et les iframes YouTube/Vimeo doivent être autorisés explicitement.

---

### 🟡 M2 — Gel d'abonnement appliqué seulement dans le layout

**Fichier :** `src/app/dashboard/layout.tsx:72-108`

**Code concerné :**
```tsx
if (profile.role !== "ADMIN" && profile.status === "PENDING_PAYMENT") {
  return <FrozenAccountScreen ... />;   // {children} non rendu
}
if (status?.frozen) { return <FrozenAccountScreen ... />; }
```

**Risque :** la documentation Next.js 16 embarquée (`01-app/02-guides/authentication.md`) est explicite : *« a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload »*. Les pages et les Server Actions sont d'autres points d'entrée.

La plupart des pages revérifient `status === "ACTIVE"`, ce qui neutralise le cas `PENDING_PAYMENT`. En revanche, **un membre dont l'abonnement est expiré (« gelé ») reste `ACTIVE`**. Il peut donc toujours appeler les actions `initiateTransferAction`, `requestWithdrawalAction`, `requestMentorshipAction`, `joinAmbassadorProgramAction`, etc., et récupérer le contenu RSC des pages.

**Correctif :** une garde réutilisable dans la couche d'accès aux données.
```ts
// src/services/auth/current-user.ts
import { db } from "@/db/client";
import { getSubscriptionStatus } from "@/repositories/subscriptions";

export async function requireActiveMember() {
  const current = await requireUser();
  if (current.profile.role === "ADMIN") return current;
  if (current.profile.status !== "ACTIVE") redirect("/dashboard");
  const subscription = await getSubscriptionStatus(db, current.profile.id);
  if (subscription.frozen) redirect("/dashboard/subscription");
  return current;
}
```
Utilise-la à la place de `requireUser()` dans les pages et actions réservées aux membres à jour.

**⚠️ Décision produit :** un membre gelé doit-il pouvoir **retirer** ses gains déjà acquis ? Si oui, garde `requireUser()` sur les retraits et documente ce choix.

---

### 🟡 M3 — Métadonnées d'inscription Supabase non validées

**Fichiers :**
- `src/services/auth/ensure-profile.ts:12-27`
- `src/app/auth/callback/route.ts:26-29`

**Code vulnérable :**
```ts
const username = typeof user.user_metadata?.username === "string"
  ? user.user_metadata.username : `membre_${...}`;            // aucune validation
...
const sponsorId = data.user.user_metadata?.sponsor_id;
if (typeof sponsorId === "string") await assignSponsor(db, data.user.id, sponsorId);
```

**Risque :** la clé anon est publique. N'importe qui peut donc appeler directement l'endpoint Supabase `/auth/v1/signup` avec des métadonnées arbitraires et **contourner totalement `registerSchema`** :
- pseudo sans regex ni limite de longueur, pouvant contenir du HTML (injecté ensuite dans les emails, voir M4) ;
- parrain obligatoire contourné, ou parrain arbitraire ;
- `wants_ambassador` avec un parrain non ambassadeur. Cela fait échouer plus tard la transaction du webhook de paiement : le paiement réel reste bloqué, ce que le commentaire de `register.ts` cherchait justement à éviter ;
- un `sponsor_id` inexistant fait planter le callback (erreur 500).

Un membre sans parrain peut aussi définir `sponsor_id` après coup via `auth.updateUser({ data })`, puis repasser par `/auth/callback` (lien de réinitialisation) pour s'attribuer un parrain.

**Correctif :**
```ts
// src/services/auth/ensure-profile.ts
import { registerSchema, usernameSchema } from "@/schemas/auth";

export async function ensureProfile(user: User) {
  const existing = await findProfileById(user.id);
  if (existing) return existing;

  // user_metadata est contrôlable par l'utilisateur (signUp/updateUser avec la
  // clé anon publique) : on le traite comme une entrée non fiable.
  const parsedName = registerSchema.shape.fullName.safeParse(user.user_metadata?.full_name);
  const parsedUsername = usernameSchema.safeParse(user.user_metadata?.username);

  return insertProfileIfMissing({
    id: user.id,
    fullName: parsedName.success ? parsedName.data : "",
    username: parsedUsername.success ? parsedUsername.data : `membre_${user.id.slice(0, 8)}`,
    wantsAmbassador: user.user_metadata?.wants_ambassador === true,
  });
}
```
```ts
// src/app/auth/callback/route.ts
import { z } from "zod";
import { findProfileById } from "@/repositories/profiles";

const parsedSponsor = z.string().uuid().safeParse(data.user.user_metadata?.sponsor_id);
if (parsedSponsor.success && parsedSponsor.data !== data.user.id) {
  const sponsor = await findProfileById(parsedSponsor.data);
  if (sponsor && sponsor.status !== "DELETED") {
    await assignSponsor(db, data.user.id, sponsor.id);
  }
}
```
Pour aller plus loin, un **Auth Hook « Before User Created »** Supabase peut rejeter toute inscription dont les métadonnées sont invalides. Une autre option consiste à stocker le parrain côté serveur (table `pending_registrations` indexée par email) plutôt que dans `user_metadata`.

---

### 🟡 M4 — Injection HTML dans les emails transactionnels

**Fichiers :**
- `src/services/wallet/initiate-transfer.ts:88` (`recipient.username`)
- `src/services/subscriptions/request-subscription-wallet.ts:110` (`buyer.username`)
- `src/services/account/request-account-deletion.ts:99` (`target.fullName`, `target.username`)
- `src/services/admin/initiate-recharge.ts:70` (`beneficiary.fullName`, `beneficiary.username`)
- `src/services/subscriptions/send-expiry-reminders.ts` (à vérifier, même motif)

**Risque :** `fullName` accepte n'importe quel caractère (`registerSchema` : seulement `min(2).max(120)`), et `username` aussi via M3. Un attaquant peut insérer `<a href="https://phish…">Cliquez ici pour sécuriser votre compte</a>` dans un email **envoyé depuis ton domaine vérifié**. Cela vise d'autres membres (H3) et les administrateurs (suppression, recharge).

**Correctif :**
```ts
// src/lib/escape-html.ts
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
```
```ts
// exemple : initiate-transfer.ts
html: `<p>Vous avez demandé à transférer <strong>${amount.toLocaleString("fr-FR")} F</strong>
       à <strong>${escapeHtml(recipient.username)}</strong>.</p> ...`,
```
Applique-le à **chaque** interpolation de donnée utilisateur dans un template HTML. Tu peux aussi restreindre `fullName` : `.regex(/^[\p{L}\p{M}' .-]+$/u)`.

---

### 🟡 M5 — Divergence entre les migrations et la production (RLS)

**Constat vérifié en production (lecture seule) :**
- ✅ RLS **activée sur toutes les tables** `public`. Elle est posée par la fonction Supabase `rls_auto_enable`, pas par les migrations.
- ✅ `anon`/`authenticated` n'ont **aucun** privilège `SELECT/INSERT/UPDATE/DELETE`. La sonde REST renvoie `42501` sur 8 tables.
- ⚠️ `anon`/`authenticated` conservent `REFERENCES, TRIGGER, TRUNCATE` sur **les 38 tables**. `TRUNCATE` n'est pas soumis à la RLS. Ce n'est pas exploitable via PostgREST, mais c'est une hygiène à corriger.

**Constat dans le dépôt :** 17 tables sont créées **sans** `ENABLE ROW LEVEL SECURITY` dans les migrations :
`account_deletion_requests, admin_recharge_requests, ambassador_profiles, commission_rules, mentor_profiles, mentor_reviews, mentorships, payment_settings, quiz_attempts, quiz_questions, quizzes, referral_clicks, refunds, sales, subscription_wallet_requests, subscriptions, withdrawal_requests`.

**Risque :** si un environnement est recréé à partir des migrations (staging, reprise après sinistre, nouveau projet Supabase avec les droits par défaut historiques), ces tables deviennent **lisibles et modifiables par tout utilisateur connecté**. Cela permettrait de réécrire `commission_rules`, d'insérer des `subscriptions`, de modifier `target_user_id` dans `account_deletion_requests` pour supprimer n'importe quel compte, ou de remplacer `otp_code_hash` pour contourner les OTP. `SECURITY.md` affirme à tort que la RLS est activée partout.

**Correctif :** nouvelle migration idempotente, sans effet sur la production actuelle.
```sql
-- src/db/migrations/0054_enforce_rls_and_revoke.sql
ALTER TABLE "account_deletion_requests"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_recharge_requests"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ambassador_profiles"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "commission_rules"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentor_profiles"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentor_reviews"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mentorships"                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_settings"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_attempts"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_questions"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referral_clicks"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sales"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_wallet_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "withdrawal_requests"          ENABLE ROW LEVEL SECURITY;

-- L'application n'accède jamais aux tables via anon/authenticated
-- (Drizzle = connexion directe ; Storage passe par is_admin(), SECURITY DEFINER).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
```
Mets aussi à jour `SECURITY.md`. Ajoute enfin un test CI qui échoue si une table `public` a `relrowsecurity = false`.

---

### 🟡 M6 — Changement de mot de passe sans ré-authentification

**Fichier :** `src/app/dashboard/settings/actions.ts:47-61`

**Code vulnérable :**
```ts
// No current-password check: the member is already authenticated...
export async function changePasswordAction(input: unknown) {
  await requireUser();
  ...
  const { error } = await updatePassword(parsed.data);
```

**Risque :** une session volée ou un poste laissé ouvert suffit pour **prendre définitivement le contrôle du compte**, qui contient un wallet avec de l'argent réel. La politique de mot de passe est aussi faible : 8 caractères, sans vérification des fuites connues.

**Correctif :**
```ts
// src/schemas/auth.ts
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  password: z.string().min(12, "12 caractères minimum").max(72),
});
```
```ts
// src/services/auth/change-password.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/schemas/auth";

export async function changePassword(input: unknown) {
  const { currentPassword, password } = changePasswordSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Session invalide." };

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (reauthError) return { error: "Mot de passe actuel incorrect." };

  const { error } = await supabase.auth.updateUser({ password });
  return { error: error ? "Impossible de modifier le mot de passe." : null };
}
```
Dans Supabase > Auth, active aussi **Secure password change**, **Leaked password protection** (HaveIBeenPwned) et une longueur minimale de 12 caractères. Pense à la **MFA (TOTP)**, au moins pour les comptes `ADMIN`.

---

### 🟡 M7 — Montant jamais comparé lors des confirmations

**Fichiers :**
- `src/app/dashboard/subscription/actions.ts:151-177` (`checkSubscriptionConfirmedAction`)
- `src/services/admin/reconcile-payment.ts`
- les 3 routes webhook

**Risque :** `verifyPayment()` renvoie `amount`, mais personne ne le compare à `payment.amount`. Si un prestataire confirme un montant différent (erreur d'intégration, manipulation de la page de paiement hébergée, devise XAF au lieu de XOF), l'abonnement complet est accordé.

**Correctif :**
```ts
const verified = await provider.verifyPayment(payment.providerReference);
if (verified.status === "PENDING") return "PENDING";
if (verified.status === "CONFIRMED" && verified.amount !== payment.amount) {
  console.error("Montant incohérent", { paymentId: payment.id, expected: payment.amount, got: verified.amount });
  return "PENDING"; // à traiter manuellement par un admin
}
```
**À vérifier :** l'unité de `amount` renvoyée par chaque prestataire. Moneroo peut par exemple exprimer le montant en unités mineures.

---

### 🟡 M8 — Fuite de messages d'erreur internes

**Fichiers et code :**
```ts
// src/services/payments/bictorys.ts:81-84 : corps brut du prestataire renvoyé au membre
throw new Error(`Bictorys ${path} a répondu ${response.status} : ${body}`);
```
```ts
// routes webhook : message Zod/interne renvoyé à l'appelant
return NextResponse.json({ error: (error as Error).message }, { status: 400 });
```
```ts
// src/services/auth/login.ts : message Supabase brut ("Email not confirmed" révèle l'existence du compte)
return { error: error?.message ?? null };
```

**Correctif :** journaliser le détail côté serveur et renvoyer un message générique.
```ts
if (!response.ok) {
  const body = await response.text();
  console.error(`Bictorys ${path} a répondu ${response.status} :`, body);
  throw new Error("Le service de paiement a refusé la requête. Veuillez réessayer.");
}
```
Dans les webhooks, renvoie `{ error: "Invalid webhook" }`. Pour le login, renvoie « Email ou mot de passe incorrect. », sauf si tu veux conserver un message spécifique pour « email non confirmé » (compromis UX contre énumération).

---

### 🔵 L1 — URL construites depuis l'en-tête `Origin`

**Fichiers :** `src/app/dashboard/subscription/actions.ts:45`, `src/services/auth/register.ts:57`, `src/services/auth/request-password-reset.ts:9`

```ts
const origin = (await headers()).get("origin") ?? "http://localhost:3000";
```
L'origine sert à construire `emailRedirectTo`, `returnUrl` et le `callback_url` PayDunya. Le risque est atténué par la vérification Origin/Host des Server Actions et par la liste blanche de redirection Supabase (**à vérifier**). La valeur de repli `localhost` est aussi fragile en production.

**Correctif :** `const origin = getSiteEnv().SITE_URL;` (le module `src/config/env.site.ts` existe déjà).

### 🔵 L2 — `CRON_SECRET` comparé avec `!==`

**Fichier :** `src/app/api/cron/subscription-reminders/route.ts:11`
```ts
import { timingSafeEqual } from "node:crypto";

const expected = Buffer.from(`Bearer ${getCronEnv().CRON_SECRET}`);
const received = Buffer.from(request.headers.get("authorization") ?? "");
if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
```

### 🔵 L3 — `/r/[code]` : écriture anonyme illimitée

**Fichier :** `src/app/r/[code]/route.ts`. Chaque GET anonyme insère une ligne dans `referral_clicks`. Un `?course=` qui n'est pas un UUID provoque une erreur 500.
```ts
const codeParse = usernameSchema.safeParse(code);
const courseParse = z.string().uuid().optional().safeParse(searchParams.get("course") ?? undefined);
if (!codeParse.success || !courseParse.success) return NextResponse.redirect(origin);
if (await isRateLimited("referralClick", `ip:${await getClientIp()}`)) return NextResponse.redirect(origin);
```

### 🔵 L4 — Énumération pseudo → nom complet sans authentification

**Fichier :** `src/app/(auth)/register/actions.ts:14`. Ajoute le rate limit `lookup` par IP. Tu peux aussi n'afficher qu'un prénom avec une initiale (« Awa K. »).

### 🔵 L5 — Réponses du quiz divulguées en cas d'échec

**Fichier :** `src/services/lms/submit-quiz-attempt.ts:62-94`. `correctOptionId` est renvoyé pour chaque question, même en cas d'échec, et les tentatives sont illimitées. Une tentative ratée révèle donc toutes les réponses. L'objet `answers` est stocké sans limite de taille.
```ts
const answersSchema = z.record(z.string().uuid(), z.string().uuid()).refine((a) => Object.keys(a).length <= 100);
...
results: passed ? results : results.map(({ questionId, correct }) => ({ questionId, correct, correctOptionId: "" })),
```

### 🔵 L6 — Cookies de session Supabase non `HttpOnly`

`@supabase/ssr` pose des cookies lisibles en JavaScript par défaut. Le client navigateur `src/lib/supabase/client.ts` **n'est importé nulle part**. Tu peux donc supprimer ce fichier et forcer `HttpOnly` dans les deux `setAll` (`src/proxy.ts`, `src/lib/supabase/server.ts`) :
```ts
cookiesToSet.forEach(({ name, value, options }) =>
  response.cookies.set(name, value, {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  }),
);
```
**À tester :** connexion, déconnexion, rafraîchissement de session et flux de réinitialisation après ce changement.

### 🔵 L7 — Buckets Storage sans limite

Les buckets `course-thumbnails` et `reward-images` ont `file_size_limit = null` et `allowed_mime_types = null`. Le type MIME n'est vérifié que via `file.type`, une valeur déclarée par le client (en upload réservé aux admins).
```sql
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp']
WHERE id IN ('course-thumbnails', 'reward-images');
```

### 🔵 L8 — Entrées admin validées seulement par les types TypeScript

Les actions `src/app/admin/**/actions.ts` reçoivent des objets typés en TypeScript, mais **rien n'est validé à l'exécution**. Un `rate` négatif, `NaN` ou un `commissionType` hors enum n'est bloqué que si le service le vérifie lui-même. Le risque est limité aux comptes admin (compromis ou erreur de saisie). Ajoute un schéma Zod par action, sur le modèle de `schemas/mentor.ts`.

### 🔵 L9 — Dépendances secondaires

- `shadcn` (CLI) figure dans `dependencies`. Il tire `@modelcontextprotocol/sdk`, `express`, `hono` et `qs`, tous signalés par l'audit → **à déplacer dans `devDependencies`**.
- Les avis `fast-uri` (via `ajv` / `@hookform/resolvers`), `js-yaml` et `sharp` se corrigent avec `npm audit fix`.

---

## 4. Points vérifiés conformes

| Catégorie | Résultat |
|---|---|
| Injection SQL | ✅ Aucune. Tout passe par Drizzle ou `sql\`\`` paramétré. Aucun `sql.raw`. Motifs `ILIKE` échappés (`escapeLikePattern`). |
| XSS | ✅ Aucun `dangerouslySetInnerHTML` avec des données utilisateur (seul un script de thème statique). Contenu des leçons rendu en texte. Embeds vidéo reconstruits vers des domaines fixes. React 19 bloque les `href="javascript:"`. |
| RCE / Command injection | ✅ Aucun `eval`, `Function`, `child_process` ou `exec` dans le code applicatif. |
| Directory traversal | ✅ Aucune lecture de fichier dynamique. Chemins Storage générés par `randomUUID`. |
| SSRF | ✅ Tous les `fetch` sortants visent des `BASE_URL` fixes (PayDunya, Bictorys, Moneroo, Resend). |
| Désérialisation | ✅ Uniquement `JSON.parse` suivi d'un schéma Zod. |
| Authentification des actions | ✅ Les **48** Server Actions appellent `requireUser()` ou `requireAdmin()`. Les services admin revérifient le rôle. |
| IDOR | ✅ Transferts, retraits, OTP, récompenses, mentorat, paiements (`beneficiaryUserId`), suppression de compte : propriétaire vérifié partout (sauf H1 et H3, qui sont des défauts de logique). |
| Élévation de privilèges | ✅ `role` et `status` ne sont jamais modifiables par le membre. Le dernier admin ne peut pas être supprimé. Un admin ne peut pas se suspendre lui-même. |
| Webhooks Moneroo / Bictorys | ✅ HMAC-SHA256 et secret comparés avec `timingSafeEqual`. Dédoublonnage `payment_events.dedupe_key`. |
| Idempotence financière | ✅ Clés uniques et `UPDATE ... WHERE status = ...` / `WHERE balance >= x`. |
| OTP | ✅ `crypto.randomInt`, hash SHA-256, comparaison en temps constant, expiration à 5 minutes (limite : H2). |
| Secrets | ✅ `.env*` ignorés par git. Aucun secret réel dans l'historique. Seules `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` sont publiques. Toutes les clés serveur sont derrière `import "server-only"`. La clé service-role n'est utilisée que dans `lock-auth-account.ts`, après une garde. |
| Logs | ✅ Aucun mot de passe, token ni OTP journalisé. (À noter : `console.error` des corps de réponse PayDunya et Bictorys, qui peuvent contenir le téléphone ou l'email client.) |
| Open redirect | ✅ `next` dans `/auth/callback` restreint aux chemins relatifs (`/…` sans `//`). |
| Stockage client | ✅ `localStorage` ne contient que la préférence de thème. |
| Storage | ✅ Écriture réservée aux admins via `is_admin()` (`SECURITY DEFINER`, `search_path` fixé). Pas de SVG. Noms aléatoires. |
| Multi-tenant | N/A. Application mono-tenant. L'isolation se fait par utilisateur (voir IDOR). |
| MFA | ❌ Absente (voir M6). |

---

## 5. Correspondance OWASP Top 10 (2021)

| Risque OWASP | Constats |
|---|---|
| A01 Broken Access Control | H1, H3, M2, M5 |
| A02 Cryptographic Failures | H5 (secret statique réutilisé comme signature) |
| A03 Injection | M4 (HTML dans les emails). SQL et XSS conformes. |
| A04 Insecure Design | H2, H3, H4, M7 |
| A05 Security Misconfiguration | M1, M5, L6, L7 |
| A06 Vulnerable Components | C1, L9 |
| A07 Identification & Authentication Failures | H6, M6, M8 (énumération) |
| A08 Software & Data Integrity Failures | H5, M3 |
| A09 Logging & Monitoring Failures | Pas d'alerte sur les échecs de webhook, d'OTP ou de montant incohérent (voir §7) |
| A10 SSRF | ✅ Conforme |

---

## 6. Fichiers à corriger en priorité

1. `package.json` (C1, L9)
2. `src/app/dashboard/subscription/actions.ts` + `paydunya-subscribe-form.tsx` + `services/subscriptions/initiate-subscription-payment.ts` (H1, M7, L1)
3. `src/services/admin/approve-withdrawal.ts` (H4)
4. `src/app/api/webhooks/providers/paydunya/route.ts` + `src/services/payments/paydunya.ts` (H5)
5. `src/services/wallet/confirm-transfer.ts`, `confirm-withdrawal.ts`, `src/services/subscriptions/confirm-subscription-wallet.ts`, `src/services/account/confirm-account-deletion.ts`, `src/services/admin/confirm-recharge.ts` (H2, H3)
6. `src/services/subscriptions/request-subscription-wallet.ts` (H3, M4)
7. `src/lib/rate-limit.ts` (nouveau) + toutes les actions d'authentification et d'OTP (H6)
8. `next.config.ts` (M1)
9. `src/services/auth/current-user.ts` + pages et actions membres (M2)
10. `src/services/auth/ensure-profile.ts`, `src/app/auth/callback/route.ts` (M3)
11. `src/lib/escape-html.ts` (nouveau) + 6 services d'email (M4)
12. `src/db/migrations/0054_enforce_rls_and_revoke.sql` (nouveau) + `SECURITY.md` (M5)

---

## 7. Plan d'action priorisé

### Immédiat (sous 24 à 48 h), avant tout nouveau trafic
1. **C1** : passer à `next@16.3.6` et redéployer.
2. **H1** : corriger la confirmation Wizall (ou désactiver temporairement l'opérateur Wizall).
3. **H4** : verrouiller avant de virer, dans `approveWithdrawal`.
4. **H5** : revérifier chaque IPN PayDunya via l'API, purger les hashes stockés et régénérer les clés si l'exposition est possible.
5. **H2 + H3** : consommer atomiquement les tentatives OTP et réserver la confirmation au propriétaire du wallet.

### Sous une semaine
6. **H6** : rate limiting (Upstash) sur l'authentification, les OTP, les lookups et `/r`.
7. **M1** : en-têtes de sécurité.
8. **M6** : ré-authentification au changement de mot de passe, réglages Supabase Auth, MFA pour les admins.
9. **M7** : contrôle du montant partout.
10. **M3 + M4** : validation des métadonnées et échappement HTML des emails.

### Sous un mois
11. **M2** : `requireActiveMember()` et décision produit sur les retraits des membres gelés.
12. **M5** : migration RLS, `REVOKE`, test CI, mise à jour de `SECURITY.md`.
13. **M8, L1 à L9** : durcissements restants.
14. CSP complète avec nonce (d'abord en Report-Only).

---

## 8. Bonnes pratiques supplémentaires

- **Supervision et alertes** : envoyer vers Sentry, ou au moins une alerte email/Slack, les événements suivants : webhook rejeté, montant incohérent, 5 échecs d'OTP d'affilée, virement en échec, recharge admin, changement de règle de commission.
- **Plafonds financiers** : maximum par transfert et par jour, et délai de sécurité (24 h) sur le premier retrait après un changement de mot de passe ou de numéro de payout.
- **Double validation admin** (principe des quatre yeux) pour les recharges au-delà d'un seuil et pour la modification des règles de commission.
- **Séparer le compte admin** du compte membre personnel, avec MFA obligatoire.
- **Validation Zod à l'exécution** sur toutes les entrées d'actions, même admin. Les types TypeScript disparaissent à l'exécution.
- **Dependabot ou Renovate**, avec `npm audit --omit=dev --audit-level=high` bloquant en CI.
- **Rotation des secrets** tous les ans et après tout départ d'une personne ayant eu accès à Vercel ou Supabase.
- **Sauvegardes chiffrées** et test de restauration trimestriel, sur un projet dont la RLS est bien appliquée par les migrations (M5).
- **Mettre à jour `SECURITY.md`** : RLS réelle, OTP à 5 minutes et non 10, rate limiting, modèle de menace des webhooks.

---

## 9. Vérifications avant la mise en production

- [ ] `npm audit --omit=dev` ne remonte aucune vulnérabilité `high` ni `critical`.
- [ ] `next build` réussit avec Next ≥ 16.3.6.
- [ ] Supabase Auth : confirmation d'email **activée**, liste blanche des URL de redirection limitée au domaine de production, leaked password protection, Secure password change, longueur minimale ≥ 12, durée du JWT ≤ 1 h, rate limits configurés.
- [ ] MFA activée sur tous les comptes `ADMIN`.
- [ ] Requête de contrôle : `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE nspname='public' AND relkind='r' AND NOT relrowsecurity;` → 0 ligne.
- [ ] Requête de contrôle : `SELECT * FROM information_schema.role_table_grants WHERE table_schema='public' AND grantee IN ('anon','authenticated');` → 0 ligne.
- [ ] Sonde REST avec la clé anon **et** avec un JWT utilisateur réel : `GET /rest/v1/<table>` renvoie 401/403 sur toutes les tables.
- [ ] En-têtes vérifiés sur le domaine de production (`curl -I https://…` ou securityheaders.com) : `X-Frame-Options`, `frame-ancestors`, `nosniff`, HSTS, `Referrer-Policy`.
- [ ] Test de concurrence : 50 confirmations OTP en parallèle sur une même demande → au plus 5 traitées.
- [ ] Test de concurrence : 2 approbations simultanées d'un même retrait → un seul virement Bictorys.
- [ ] Webhook PayDunya forgé avec un hash valide mais une facture non payée → aucun abonnement accordé.
- [ ] `confirmWizallPaymentAction` sur un paiement Bictorys → refusé.
- [ ] Rate limiting : 6 connexions ratées → blocage. 4 demandes d'OTP en une heure → blocage.
- [ ] Inscription directe via `/auth/v1/signup` avec `username: "<b>x</b>"` → profil créé avec un pseudo de repli.
- [ ] Membre à l'abonnement expiré : `initiateTransferAction` appelée directement → refusée (selon la décision produit sur M2).
- [ ] Variables Vercel : `CRON_SECRET`, `SITE_URL`, `UPSTASH_*` définies. Aucune clé serveur préfixée `NEXT_PUBLIC_`.
- [ ] Clés de paiement en mode **live** uniquement en production. Clés **test** en preview et staging.
