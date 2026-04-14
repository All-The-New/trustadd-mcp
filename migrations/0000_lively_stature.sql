CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"endpoint" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"parameters" jsonb,
	"duration_ms" integer,
	"request_id" text
);
--> statement-breakpoint
CREATE TABLE "agent_metadata_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar NOT NULL,
	"tx_hash" text NOT NULL,
	"block_number" integer NOT NULL,
	"event_type" text NOT NULL,
	"chain_id" integer DEFAULT 1 NOT NULL,
	"raw_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"chain_id" integer NOT NULL,
	"tx_hash" text NOT NULL,
	"transfer_id" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"token_address" text NOT NULL,
	"token_symbol" text NOT NULL,
	"amount" text NOT NULL,
	"amount_usd" real,
	"block_number" integer NOT NULL,
	"block_timestamp" timestamp NOT NULL,
	"category" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"erc8004_id" text NOT NULL,
	"primary_contract_address" text NOT NULL,
	"controller_address" text NOT NULL,
	"chain_id" integer DEFAULT 1 NOT NULL,
	"name" text,
	"description" text,
	"claimed" boolean DEFAULT false NOT NULL,
	"first_seen_block" integer NOT NULL,
	"last_updated_block" integer NOT NULL,
	"capabilities" text[],
	"metadata_uri" text,
	"tags" text[],
	"oasf_skills" text[],
	"oasf_domains" text[],
	"endpoints" jsonb,
	"x402_support" boolean,
	"supported_trust" text[],
	"image_url" text,
	"active_status" boolean,
	"slug" text,
	"trust_score" integer,
	"trust_score_breakdown" jsonb,
	"trust_score_updated_at" timestamp,
	"quality_tier" text DEFAULT 'unclassified',
	"spam_flags" text[] DEFAULT '{}',
	"lifecycle_status" text DEFAULT 'active',
	"metadata_fingerprint" text,
	"next_enrichment_at" timestamp,
	"last_quality_evaluated_at" timestamp,
	"trust_signal_hash" text,
	"trust_methodology_version" integer DEFAULT 1,
	"confidence_score" real,
	"confidence_level" text DEFAULT 'unknown',
	"sybil_signals" jsonb,
	"sybil_risk_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"alert_id" text PRIMARY KEY NOT NULL,
	"last_delivered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"ip" text,
	"user_agent" text,
	"referer" text,
	"country" text
);
--> statement-breakpoint
CREATE TABLE "bazaar_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_url" text NOT NULL,
	"name" text,
	"description" text,
	"category" text DEFAULT 'other' NOT NULL,
	"network" text NOT NULL,
	"asset" text,
	"asset_name" text,
	"price_raw" text,
	"price_usd" real,
	"pay_to" text,
	"scheme" text,
	"x402_version" integer,
	"method" text,
	"health_status" text,
	"uptime_pct" real,
	"avg_latency_ms" real,
	"trust_score" integer,
	"last_health_check" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"scout_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bazaar_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_services" integer DEFAULT 0 NOT NULL,
	"active_services" integer DEFAULT 0 NOT NULL,
	"new_services_count" integer DEFAULT 0 NOT NULL,
	"category_breakdown" jsonb,
	"network_breakdown" jsonb,
	"price_stats" jsonb,
	"price_by_category_stats" jsonb,
	"total_pay_to_wallets" integer DEFAULT 0 NOT NULL,
	"top_services" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_feedback_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"source_id" integer NOT NULL,
	"platform" varchar(30) NOT NULL,
	"item_type" varchar(30) NOT NULL,
	"external_id" text,
	"external_url" text,
	"author" text,
	"title" text,
	"content_snippet" text,
	"sentiment" varchar(20),
	"sentiment_score" real,
	"engagement_score" integer,
	"raw_data" jsonb,
	"posted_at" timestamp,
	"indexed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_feedback_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"platform" varchar(30) NOT NULL,
	"platform_identifier" text NOT NULL,
	"match_tier" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_scraped_at" timestamp,
	"scrape_errors" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_feedback_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"total_sources" integer DEFAULT 0 NOT NULL,
	"github_stars" integer,
	"github_forks" integer,
	"github_open_issues" integer,
	"github_last_commit_at" timestamp,
	"github_contributors" integer,
	"github_language" text,
	"github_description" text,
	"github_health_score" integer,
	"twitter_mentions" integer,
	"twitter_sentiment_pct" integer,
	"reddit_mentions" integer,
	"farcaster_followers" integer,
	"farcaster_following" integer,
	"farcaster_score" real,
	"farcaster_fid" integer,
	"farcaster_last_cast_at" timestamp,
	"farcaster_total_casts" integer,
	"farcaster_engagement_avg" real,
	"overall_score" integer,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"source" varchar(50),
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_minutes" integer DEFAULT 60 NOT NULL,
	"blocks_indexed" integer DEFAULT 0 NOT NULL,
	"cycles_completed" integer DEFAULT 0 NOT NULL,
	"cycles_failed" integer DEFAULT 0 NOT NULL,
	"rpc_requests" integer DEFAULT 0 NOT NULL,
	"rpc_errors" integer DEFAULT 0 NOT NULL,
	"avg_cycle_ms" integer DEFAULT 0 NOT NULL,
	"agents_discovered" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_state" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"chain_id" integer DEFAULT 1 NOT NULL,
	"last_processed_block" integer DEFAULT 0 NOT NULL,
	"is_running" boolean DEFAULT false NOT NULL,
	"last_error" text,
	"last_synced_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_health" (
	"task_id" text PRIMARY KEY NOT NULL,
	"task_name" text NOT NULL,
	"last_success_at" timestamp,
	"last_run_at" timestamp,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"circuit_state" text DEFAULT 'closed' NOT NULL,
	"opened_at" timestamp,
	"expected_interval_minutes" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_entries" (
	"key" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_sync_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_address" text NOT NULL,
	"chain_id" integer NOT NULL,
	"last_synced_block" integer NOT NULL,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"lookup_address" text NOT NULL,
	"lookup_chain_id" integer,
	"verdict" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"tier" text DEFAULT 'unclassified' NOT NULL,
	"quick_check_data" jsonb NOT NULL,
	"full_report_data" jsonb NOT NULL,
	"report_version" integer DEFAULT 1 NOT NULL,
	"compiled_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"quick_check_access_count" integer DEFAULT 0 NOT NULL,
	"full_report_access_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x402_probes" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"endpoint_url" text NOT NULL,
	"endpoint_name" text,
	"probe_status" text NOT NULL,
	"http_status" integer,
	"payment_address" text,
	"payment_network" text,
	"payment_token" text,
	"payment_amount" text,
	"response_headers" jsonb,
	"chain_id" integer NOT NULL,
	"probed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_metadata_events" ADD CONSTRAINT "agent_metadata_events_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_transactions" ADD CONSTRAINT "agent_transactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_feedback_items" ADD CONSTRAINT "community_feedback_items_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_feedback_items" ADD CONSTRAINT "community_feedback_items_source_id_community_feedback_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."community_feedback_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_feedback_sources" ADD CONSTRAINT "community_feedback_sources_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_feedback_summaries" ADD CONSTRAINT "community_feedback_summaries_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_reports" ADD CONSTRAINT "trust_reports_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x402_probes" ADD CONSTRAINT "x402_probes_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_log_timestamp" ON "admin_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_events_agent_id" ON "agent_metadata_events" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_events_chain_date" ON "agent_metadata_events" USING btree ("chain_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_transfer_id_chain" ON "agent_transactions" USING btree ("transfer_id","chain_id");--> statement-breakpoint
CREATE INDEX "idx_agent_transactions_agent_id" ON "agent_transactions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agents_chain_id" ON "agents" USING btree ("chain_id");--> statement-breakpoint
CREATE INDEX "idx_agents_chain_erc8004" ON "agents" USING btree ("chain_id","erc8004_id");--> statement-breakpoint
CREATE INDEX "idx_agents_slug" ON "agents" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_agents_quality_tier" ON "agents" USING btree ("quality_tier");--> statement-breakpoint
CREATE INDEX "idx_agents_trust_score" ON "agents" USING btree ("trust_score");--> statement-breakpoint
CREATE INDEX "idx_agents_lifecycle_status" ON "agents" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "idx_api_request_log_ts" ON "api_request_log" USING btree ("ts");--> statement-breakpoint
CREATE INDEX "idx_api_request_log_ip" ON "api_request_log" USING btree ("ip","ts");--> statement-breakpoint
CREATE INDEX "idx_api_request_log_path" ON "api_request_log" USING btree ("path","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bazaar_resource_url" ON "bazaar_services" USING btree ("resource_url");--> statement-breakpoint
CREATE INDEX "idx_bazaar_category" ON "bazaar_services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_bazaar_network" ON "bazaar_services" USING btree ("network");--> statement-breakpoint
CREATE INDEX "idx_bazaar_pay_to" ON "bazaar_services" USING btree ("pay_to");--> statement-breakpoint
CREATE INDEX "idx_bazaar_price_usd" ON "bazaar_services" USING btree ("price_usd");--> statement-breakpoint
CREATE INDEX "idx_bazaar_is_active" ON "bazaar_services" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_bazaar_snapshot_date" ON "bazaar_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_feedback_source_external" ON "community_feedback_items" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_community_feedback_items_agent_id" ON "community_feedback_items" USING btree ("agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_source_agent_platform_id" ON "community_feedback_sources" USING btree ("agent_id","platform","platform_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_summary_agent" ON "community_feedback_summaries" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_indexer_events_chain_date" ON "indexer_events" USING btree ("chain_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_rate_limit_key_window" ON "rate_limit_entries" USING btree ("key","window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sync_addr_chain" ON "transaction_sync_state" USING btree ("payment_address","chain_id");--> statement-breakpoint
CREATE INDEX "idx_trust_reports_lookup_address" ON "trust_reports" USING btree ("lookup_address");--> statement-breakpoint
CREATE INDEX "idx_trust_reports_agent_id" ON "trust_reports" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_trust_reports_expires_at" ON "trust_reports" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trust_reports_agent" ON "trust_reports" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_probes_agent_id" ON "x402_probes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_probes_probed_at" ON "x402_probes" USING btree ("probed_at");--> statement-breakpoint
CREATE INDEX "idx_probes_agent_probed" ON "x402_probes" USING btree ("agent_id","probed_at");