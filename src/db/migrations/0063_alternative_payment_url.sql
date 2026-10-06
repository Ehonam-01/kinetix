ALTER TABLE "payment_settings" ADD COLUMN "alternative_payment_url" text;--> statement-breakpoint
-- The Maketou shop page the admin asked to offer, editable afterwards from
-- admin → Paiements.
UPDATE "payment_settings" SET "alternative_payment_url" = 'https://kinetix-e-learning.mymaketou.shop/products/membre-resident-abonnement-annuel/checkout' WHERE "id" = 'default';
