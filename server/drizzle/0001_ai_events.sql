CREATE TABLE "ai_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"source" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"ok" boolean NOT NULL,
	"error_code" text,
	"calls" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"prompt" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_events_subject_created_idx" ON "ai_events" USING btree ("subject","created_at" DESC NULLS LAST);