CREATE TABLE "mpp_directory_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_url" text NOT NULL,
	"service_name" text,
	"provider_name" text,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"pricing_model" text,
	"price_amount" text,
	"price_currency" text,
	"payment_methods" jsonb,
	"recipient_address" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mpp_service_url" ON "mpp_directory_services" USING btree ("service_url");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_category" ON "mpp_directory_services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_is_active" ON "mpp_directory_services" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mpp_service_last_seen" ON "mpp_directory_services" USING btree ("last_seen_at");--> statement-breakpoint

CREATE TABLE "mpp_directory_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_services" integer DEFAULT 0 NOT NULL,
	"active_services" integer DEFAULT 0 NOT NULL,
	"category_breakdown" jsonb,
	"pricing_model_breakdown" jsonb,
	"payment_method_breakdown" jsonb,
	"price_stats" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mpp_snapshot_date" ON "mpp_directory_snapshots" USING btree ("snapshot_date");--> statement-breakpoint

CREATE TABLE "mpp_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"endpoint_url" text NOT NULL,
	"probe_status" text NOT NULL,
	"http_status" integer,
	"has_mpp" boolean DEFAULT false NOT NULL,
	"payment_methods" jsonb,
	"tempo_address" text,
	"challenge_data" jsonb,
	"response_headers" jsonb,
	"probed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mpp_probes" ADD CONSTRAINT "mpp_probes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_agent" ON "mpp_probes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_has_mpp" ON "mpp_probes" USING btree ("has_mpp");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_tempo_addr" ON "mpp_probes" USING btree ("tempo_address");--> statement-breakpoint
CREATE INDEX "idx_mpp_probes_probed_at" ON "mpp_probes" USING btree ("probed_at");
