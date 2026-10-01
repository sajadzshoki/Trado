ALTER TABLE "assets" ADD COLUMN "icon_data" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "price_provider" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "external_asset_id" text;