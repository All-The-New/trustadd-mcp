CREATE TABLE "trust_anchors" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar NOT NULL,
	"merkle_root" text NOT NULL,
	"merkle_proof" jsonb NOT NULL,
	"leaf_index" integer NOT NULL,
	"leaf_hash" text NOT NULL,
	"anchored_score" integer NOT NULL,
	"anchored_methodology_version" integer DEFAULT 1 NOT NULL,
	"anchor_tx_hash" text,
	"anchor_block_number" integer,
	"anchored_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trust_anchors" ADD CONSTRAINT "trust_anchors_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_trust_anchor_agent" ON "trust_anchors" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_trust_anchors_merkle_root" ON "trust_anchors" USING btree ("merkle_root");--> statement-breakpoint
CREATE INDEX "idx_trust_anchors_anchored_at" ON "trust_anchors" USING btree ("anchored_at");