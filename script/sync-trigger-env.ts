/**
 * Syncs environment variables to Trigger.dev production environment.
 * Run during CI deploy: npx tsx script/sync-trigger-env.ts
 *
 * Reads from process.env and uploads to Trigger.dev project via API.
 * Only syncs variables that are explicitly listed (not all env vars).
 */

const PROJECT_REF = "proj_nabhtdcabmsfzbmlifqh";
const ENV_SLUG = "prod";
const API_BASE = "https://api.trigger.dev/api/v1";

// Variables to sync from CI environment to Trigger.dev
const SYNC_VARS = [
  "DATABASE_URL",
  "API_KEY_ALCHEMY",
  "API_KEY_INFURA",
  "API_KEY_NEYNAR",
  "GITHUB_TOKEN",
  "RESEND_API_KEY",
  "ALERT_EMAIL",
  "ALERT_WEBHOOK_URL",
  "ENABLE_TX_INDEXER",
  "ENABLE_RERESOLVE",
  "ENABLE_PROBER",
  "SENTRY_DSN",
  "MPP_PAY_TO_ADDRESS",
  "TEMPO_RPC_URL",
];

async function main() {
  const token = process.env.TRIGGER_ACCESS_TOKEN;
  if (!token) {
    console.error("TRIGGER_ACCESS_TOKEN not set");
    process.exit(1);
  }

  const variables: Record<string, string> = {};
  for (const name of SYNC_VARS) {
    const value = process.env[name];
    if (value) variables[name] = value;
  }

  const names = Object.keys(variables);
  if (names.length === 0) {
    console.log("No env vars to sync (none set in CI environment)");
    return;
  }

  console.log(`Syncing ${names.length} env vars to Trigger.dev ${ENV_SLUG}...`);

  const response = await fetch(
    `${API_BASE}/projects/${PROJECT_REF}/envvars/${ENV_SLUG}/import`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ variables, override: true }),
    },
  );

  const result = await response.json();

  if (response.ok && (result as any).success) {
    console.log(`Successfully synced: ${names.join(", ")}`);
  } else {
    console.error(`Failed to sync (${response.status}):`, JSON.stringify(result));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Env sync failed:", err.message);
  process.exit(1);
});
