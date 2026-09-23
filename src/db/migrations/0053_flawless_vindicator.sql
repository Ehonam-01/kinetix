CREATE TYPE "public"."mentorship_status" AS ENUM('REQUESTED', 'ACCEPTED', 'DECLINED');--> statement-breakpoint
CREATE TABLE "mentor_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentorship_id" uuid NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"mentee_user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mentor_reviews_mentorship_id_unique" UNIQUE("mentorship_id")
);
--> statement-breakpoint
CREATE TABLE "mentorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentor_user_id" uuid NOT NULL,
	"mentee_user_id" uuid NOT NULL,
	"status" "mentorship_status" DEFAULT 'REQUESTED' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mentor_reviews" ADD CONSTRAINT "mentor_reviews_mentorship_id_mentorships_id_fk" FOREIGN KEY ("mentorship_id") REFERENCES "public"."mentorships"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_reviews" ADD CONSTRAINT "mentor_reviews_mentor_user_id_profiles_id_fk" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentor_reviews" ADD CONSTRAINT "mentor_reviews_mentee_user_id_profiles_id_fk" FOREIGN KEY ("mentee_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentor_user_id_profiles_id_fk" FOREIGN KEY ("mentor_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mentorships" ADD CONSTRAINT "mentorships_mentee_user_id_profiles_id_fk" FOREIGN KEY ("mentee_user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mentor_reviews_mentor_idx" ON "mentor_reviews" USING btree ("mentor_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mentorships_mentor_mentee_unique" ON "mentorships" USING btree ("mentor_user_id","mentee_user_id");--> statement-breakpoint
CREATE INDEX "mentorships_mentor_idx" ON "mentorships" USING btree ("mentor_user_id");--> statement-breakpoint
CREATE INDEX "mentorships_mentee_idx" ON "mentorships" USING btree ("mentee_user_id");