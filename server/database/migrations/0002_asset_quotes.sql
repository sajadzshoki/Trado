CREATE TABLE "asset_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"price_usd" numeric(38, 12) NOT NULL,
	"usd_toman_rate" numeric(38, 8) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"quoted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_quotes_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "asset_quotes_price_positive" CHECK ("asset_quotes"."price_usd" > 0),
	CONSTRAINT "asset_quotes_rate_positive" CHECK ("asset_quotes"."usd_toman_rate" > 0)
);
--> statement-breakpoint
ALTER TABLE "asset_quotes" ADD CONSTRAINT "asset_quotes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_quotes" ADD CONSTRAINT "asset_quotes_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_quotes_user_idx" ON "asset_quotes" USING btree ("user_id");