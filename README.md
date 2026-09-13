# Plateforme SaaS LMS & MLM binaire

Plateforme de formation en ligne intégrant un système de progression MLM binaire (parrainage, arbre binaire, 5 niveaux, commissions, récompenses). Voir `ARCHITECTURE.md`, `DATABASE.md` et `MLM_RULES.md` pour le détail des décisions de conception.

## Stack

Next.js (App Router, TypeScript strict) · Tailwind CSS · shadcn/ui · Drizzle ORM · PostgreSQL (Supabase) · Supabase Auth · Zod · React Hook Form · Vitest · Playwright.

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les variables Supabase / DATABASE_URL
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Le projet a besoin d'un projet Supabase (Postgres + Auth) pour fonctionner au-delà de la page d'accueil — voir `.env.example` pour les variables requises.

## Scripts

| Commande                          | Rôle                                            |
| --------------------------------- | ----------------------------------------------- |
| `npm run dev`                     | Serveur de développement (Turbopack)            |
| `npm run build` / `npm start`     | Build et serveur de production                  |
| `npm run lint`                    | ESLint                                          |
| `npm run typecheck`               | Vérification TypeScript stricte                 |
| `npm run format` / `format:check` | Prettier                                        |
| `npm run test`                    | Tests unitaires (Vitest)                        |
| `npm run test:e2e`                | Tests bout en bout (Playwright)                 |
| `npm run db:generate`             | Génère une migration Drizzle à partir du schéma |
| `npm run db:migrate`              | Applique les migrations sur `DATABASE_URL`      |

## Documentation

- `ARCHITECTURE.md` — couches applicatives, choix de généalogie (ltree), architecture événementielle.
- `DATABASE.md` — schéma relationnel complet, index.
- `MLM_RULES.md` — règles de progression, placement binaire, commissions.
- `FINANCIAL_MODEL.md` — formules de calcul, ledger financier.
- `SECURITY.md` — RLS, autorisation serveur, idempotence.
- `TESTING.md` — stratégie de tests et scénarios obligatoires.
- `DEPLOYMENT.md` — déploiement Vercel/Supabase.
