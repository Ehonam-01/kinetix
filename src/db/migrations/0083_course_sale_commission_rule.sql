-- A course sold on its own pays the sponsor 15 % of its price (explicit
-- user decision), through its own DIRECT_SALE rule: the category
-- VENTE_COURS (repositories/commission-rules.ts COURSE_SALE_CATEGORY), apart
-- from the subscription's default rule. Rate in basis points.
INSERT INTO "commission_rules" ("scope", "category", "commission_type", "rate")
SELECT 'DIRECT_SALE', 'VENTE_COURS', 'PERCENTAGE', 1500
WHERE NOT EXISTS (
  SELECT 1 FROM "commission_rules"
  WHERE "scope" = 'DIRECT_SALE' AND "category" = 'VENTE_COURS' AND "course_id" IS NULL
);
