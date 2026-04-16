import type { Agent } from "@shared/schema";
import type { PublicVerdict } from "@/lib/verdict";
export function Banner(_: { agent: Agent; verdict: PublicVerdict; updatedAt: string | null }) {
  return <div className="h-[204px] rounded-md bg-muted mb-4" data-testid="banner-placeholder" />;
}
