import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { courses } from "./courses";
import { levels } from "./levels";
import { profiles } from "./profiles";

export const commissionRuleScopeEnum = pgEnum("commission_rule_scope", [
  "DIRECT_SALE",
  "GENERATION",
]);

export const commissionCalcTypeEnum = pgEnum("commission_calc_type", [
  "FIXED",
  "PERCENTAGE",
  "BV_PERCENTAGE",
]);

export type QualificationRequirement = {
  presence?: boolean;
  minBv?: number;
};

// Versioned like parameter_versions (never updated in place — a change
// closes the row currently effective and inserts a new one starting at
// that exact instant, see services/admin/update-parameter.ts for the
// pattern this will reuse), but structured rather than a flat
// key -> integer: one row can scope a rate to a specific course/category
// (scope DIRECT_SALE) or a specific level+generation (scope GENERATION),
// instead of every course/generation sharing one global rate.
//
// rate is basis points (1/100 of a percent) for PERCENTAGE/BV_PERCENTAGE —
// e.g. 800 = 8.00% — so it stays an integer (no floats anywhere in this
// codebase, XOF has no subunit, see FINANCIAL_MODEL.md) while still
// allowing fractional percentages. For FIXED, rate is a plain F CFA amount
// instead, same unit as parameter_versions.value today.
export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: commissionRuleScopeEnum("scope").notNull(),
    // DIRECT_SALE scoping — both nullable. A null courseId/category means
    // "the default rule", overridden by a more specific row when one
    // exists; resolution order between them is an application concern
    // (services/mlm/commission.ts, not built in this phase), not enforced
    // by the schema itself.
    courseId: uuid("course_id").references(() => courses.id),
    category: text("category"),
    // GENERATION scoping.
    levelCode: smallint("level_code").references(() => levels.code),
    generation: smallint("generation"),
    commissionType: commissionCalcTypeEnum("commission_type").notNull(),
    rate: integer("rate").notNull(),
    cap: integer("cap"),
    minimumBv: integer("minimum_bv"),
    qualificationRequirement: jsonb(
      "qualification_requirement",
    ).$type<QualificationRequirement>(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .notNull()
      .defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("commission_rules_scope_effective_idx").on(
      table.scope,
      table.effectiveFrom,
    ),
  ],
);
