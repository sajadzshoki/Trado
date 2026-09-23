CREATE TYPE "public"."display_currency" AS ENUM('USD', 'TOMAN');--> statement-breakpoint
CREATE TYPE "public"."app_locale" AS ENUM('en', 'fa');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('login', 'register', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initial_capital" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_usd" numeric(38, 12) NOT NULL,
	"usd_toman_rate" numeric(38, 8) NOT NULL,
	"amount_toman" numeric(38, 4) NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initial_capital_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "initial_capital_amount_positive" CHECK ("initial_capital"."amount_usd" > 0),
	CONSTRAINT "initial_capital_rate_positive" CHECK ("initial_capital"."usd_toman_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trade_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"side" "trade_side" NOT NULL,
	"quantity" numeric(38, 12) NOT NULL,
	"unit_price_usd" numeric(38, 12) NOT NULL,
	"total_usd" numeric(38, 12) NOT NULL,
	"usd_toman_rate" numeric(38, 8) NOT NULL,
	"total_toman" numeric(38, 4) NOT NULL,
	"transacted_at" timestamp with time zone NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_entries_quantity_positive" CHECK ("trade_entries"."quantity" > 0),
	CONSTRAINT "trade_entries_price_positive" CHECK ("trade_entries"."unit_price_usd" > 0),
	CONSTRAINT "trade_entries_rate_positive" CHECK ("trade_entries"."usd_toman_rate" > 0),
	CONSTRAINT "trade_entries_totals_positive" CHECK ("trade_entries"."total_usd" > 0 AND "trade_entries"."total_toman" > 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"title" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"locale" "app_locale" DEFAULT 'en' NOT NULL,
	"display_currency" "display_currency" DEFAULT 'USD' NOT NULL,
	"phone_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initial_capital" ADD CONSTRAINT "initial_capital_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_entries" ADD CONSTRAINT "trade_entries_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_entries" ADD CONSTRAINT "trade_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_user_symbol_unique" ON "assets" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "otp_challenges_phone_purpose_idx" ON "otp_challenges" USING btree ("phone","purpose");--> statement-breakpoint
CREATE INDEX "trade_entries_trade_idx" ON "trade_entries" USING btree ("trade_id","transacted_at");--> statement-breakpoint
CREATE INDEX "trade_entries_user_idx" ON "trade_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "trades_asset_idx" ON "trades" USING btree ("asset_id");