import { sql } from "drizzle-orm";
import { pgTable, text, boolean, integer, jsonb, timestamp, serial, real, uniqueIndex, index, varchar, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { agents } from "./schema.js";

export const mppDirectoryServices = pgTable("mpp_directory_services", {
  id: serial("id").primaryKey(),
  serviceUrl: text("service_url").notNull(),
  serviceName: text("service_name"),
  providerName: text("provider_name"),
  description: text("description"),
  category: text("category").notNull().default("other"),
  pricingModel: text("pricing_model"),          // charge | stream | session
  priceAmount: text("price_amount"),
  priceCurrency: text("price_currency"),
  paymentMethods: jsonb("payment_methods"),     // [{method, currency, ...}]
  recipientAddress: text("recipient_address"),
  isActive: boolean("is_active").notNull().default(true),
  firstSeenAt: timestamp("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_mpp_service_url").on(table.serviceUrl),
  index("idx_mpp_service_category").on(table.category),
  index("idx_mpp_service_is_active").on(table.isActive),
  index("idx_mpp_service_last_seen").on(table.lastSeenAt),
]);

export const mppDirectorySnapshots = pgTable("mpp_directory_snapshots", {
  id: serial("id").primaryKey(),
  snapshotDate: date("snapshot_date").notNull(),
  totalServices: integer("total_services").notNull().default(0),
  activeServices: integer("active_services").notNull().default(0),
  categoryBreakdown: jsonb("category_breakdown"),
  pricingModelBreakdown: jsonb("pricing_model_breakdown"),
  paymentMethodBreakdown: jsonb("payment_method_breakdown"),
  priceStats: jsonb("price_stats"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_mpp_snapshot_date").on(table.snapshotDate),
]);

export const mppProbes = pgTable("mpp_probes", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => agents.id),
  endpointUrl: text("endpoint_url").notNull(),
  probeStatus: text("probe_status").notNull(),  // success | no_mpp | error | timeout | unreachable
  httpStatus: integer("http_status"),
  hasMpp: boolean("has_mpp").notNull().default(false),
  paymentMethods: jsonb("payment_methods"),     // parsed from WWW-Authenticate: Payment headers
  tempoAddress: text("tempo_address"),
  challengeData: jsonb("challenge_data"),
  responseHeaders: jsonb("response_headers"),
  probedAt: timestamp("probed_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_mpp_probes_agent").on(table.agentId),
  index("idx_mpp_probes_has_mpp").on(table.hasMpp),
  index("idx_mpp_probes_tempo_addr").on(table.tempoAddress),
  index("idx_mpp_probes_probed_at").on(table.probedAt),
]);

export const insertMppDirectoryServiceSchema = createInsertSchema(mppDirectoryServices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMppDirectorySnapshotSchema = createInsertSchema(mppDirectorySnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertMppProbeSchema = createInsertSchema(mppProbes).omit({
  id: true,
  probedAt: true,
  createdAt: true,
});

export type MppDirectoryService = typeof mppDirectoryServices.$inferSelect;
export type InsertMppDirectoryService = z.infer<typeof insertMppDirectoryServiceSchema>;
export type MppDirectorySnapshot = typeof mppDirectorySnapshots.$inferSelect;
export type InsertMppDirectorySnapshot = z.infer<typeof insertMppDirectorySnapshotSchema>;
export type MppProbe = typeof mppProbes.$inferSelect;
export type InsertMppProbe = z.infer<typeof insertMppProbeSchema>;
