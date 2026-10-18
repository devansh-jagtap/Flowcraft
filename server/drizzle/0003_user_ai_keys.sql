CREATE TABLE "user_ai_keys" (
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text NOT NULL,
	"model" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ai_keys_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_provider" text;--> statement-breakpoint
ALTER TABLE "user_ai_keys" ADD CONSTRAINT "user_ai_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;