ALTER TABLE "courses" ADD COLUMN "preview_video_url" text;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "learning_outcomes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "target_audience" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "faq" jsonb DEFAULT '[]'::jsonb NOT NULL;