import type { Agent } from "@shared/schema";
import type { PublicVerdict } from "@/lib/verdict";
import type { CategoryStrengths } from "@/components/category-bars";
export function ScoreTab(_: { agent: Agent; verdict: PublicVerdict; strengths: CategoryStrengths | null }) {
  return <div data-testid="score-stub">Score</div>;
}
