/**
 * Syncs environment variables to Trigger.dev production environment.
 * Run during CI deploy: npx tsx script/sync-trigger-env.ts
 *
 * Reads from process.env and uploads to Trigger.dev project.
 * Only syncs variables that are explicitly listed (not all env vars).
 */
import { envvars } from "@trigger.dev/sdk/v3";

const PROJECT_REF = "proj_nabhtdcabmsfzbmlifqh";
const ENV_SLUG = "prod";

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
];

async function main() {
  const variables: { name: string; value: string }[] = [];

  for (const name of SYNC_VARS) {
    const value = process.env[name];
    if (value) {
      variables.push({ name, value });
    }
  }

  if (variables.length === 0) {
    console.log("No env vars to sync (none set in CI environment)");
    return;
  }

  console.log(`Syncing ${variables.length} env vars to Trigger.dev ${ENV_SLUG}...`);

  const result = await envvars.upload(PROJECT_REF, ENV_SLUG, {
    variables,
    override: true,
  });

  if (result.ok) {
    console.log(`Successfully synced: ${variables.map((v) => v.name).join(", ")}`);
  } else {
    console.error("Failed to sync env vars:", result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Env sync failed:", err.message);
  process.exit(1);
});
