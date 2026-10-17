CREATE TABLE "ai_usage" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"resets_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagrams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(100) DEFAULT 'Untitled diagram' NOT NULL,
	"type" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT 'ocean' NOT NULL,
	"direction" text DEFAULT 'TB' NOT NULL,
	"positions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prompts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_id" text,
	"views" integer DEFAULT 0 NOT NULL,
	"forked_from" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagrams_share_id_unique" UNIQUE("share_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text,
	"name" varchar(60) NOT NULL,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagrams" ADD CONSTRAINT "diagrams_forked_from_diagrams_id_fk" FOREIGN KEY ("forked_from") REFERENCES "public"."diagrams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_usage_resets_at_idx" ON "ai_usage" USING btree ("resets_at");--> statement-breakpoint
CREATE INDEX "diagrams_owner_updated_idx" ON "diagrams" USING btree ("owner_id","updated_at" DESC NULLS LAST);