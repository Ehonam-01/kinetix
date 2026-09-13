CREATE TYPE "public"."binary_position" AS ENUM('LEFT', 'RIGHT');--> statement-breakpoint
CREATE TYPE "public"."placement_method" AS ENUM('AUTO_GREEDY', 'MANUAL', 'ADMIN_OVERRIDE');--> statement-breakpoint
CREATE TABLE "sponsorships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "binary_nodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"binary_parent_id" uuid,
	"binary_position" "binary_position",
	"path" "ltree" NOT NULL,
	"depth" integer NOT NULL,
	"left_subtree_count" integer DEFAULT 0 NOT NULL,
	"right_subtree_count" integer DEFAULT 0 NOT NULL,
	"placement_method" "placement_method" DEFAULT 'AUTO_GREEDY' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsorships" ADD CONSTRAINT "sponsorships_sponsor_id_profiles_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binary_nodes" ADD CONSTRAINT "binary_nodes_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binary_nodes" ADD CONSTRAINT "binary_nodes_binary_parent_id_binary_nodes_id_fk" FOREIGN KEY ("binary_parent_id") REFERENCES "public"."binary_nodes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sponsorships_user_id_unique" ON "sponsorships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sponsorships_sponsor_id_idx" ON "sponsorships" USING btree ("sponsor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "binary_nodes_user_id_unique" ON "binary_nodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "binary_nodes_parent_idx" ON "binary_nodes" USING btree ("binary_parent_id");--> statement-breakpoint
CREATE INDEX "binary_nodes_depth_idx" ON "binary_nodes" USING btree ("depth");