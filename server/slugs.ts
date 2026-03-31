import { db } from "./db";
import { agents } from "../shared/schema";
import { isNull, eq } from "drizzle-orm";

export function generateSlug(name: string | null, erc8004Id: string, chainId: number): string {
  const chainPrefix: Record<number, string> = {
    1: "",
    8453: "base-",
    56: "bnb-",
    137: "polygon-",
    42161: "arb-",
  };

  if (name) {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    if (base.length >= 2) {
      const prefix = chainPrefix[chainId] ?? `chain${chainId}-`;
      return `${prefix}${base}-${erc8004Id}`;
    }
  }

  const prefix = chainPrefix[chainId] ?? `chain${chainId}-`;
  return `${prefix}agent-${erc8004Id}`;
}

export async function ensureSlugsGenerated(): Promise<void> {
  const unsluggedCount = await db.select({ id: agents.id })
    .from(agents)
    .where(isNull(agents.slug))
    .limit(1);

  if (unsluggedCount.length === 0) {
    console.log("[slugs] All agents have slugs");
    return;
  }

  console.log("[slugs] Generating slugs for agents without them...");
  const batch = 500;
  let processed = 0;

  while (true) {
    const rows = await db.select({
      id: agents.id,
      name: agents.name,
      erc8004Id: agents.erc8004Id,
      chainId: agents.chainId,
    })
      .from(agents)
      .where(isNull(agents.slug))
      .limit(batch);

    if (rows.length === 0) break;

    for (const row of rows) {
      const slug = generateSlug(row.name, row.erc8004Id, row.chainId);
      await db.update(agents)
        .set({ slug })
        .where(eq(agents.id, row.id));
    }

    processed += rows.length;
  }

  console.log(`[slugs] Generated slugs for ${processed} agents`);
}
