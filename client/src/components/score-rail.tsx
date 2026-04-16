import { cn } from "@/lib/utils";
import { TrustStamp } from "./trust-stamp";
import { verdictDescriptor, type PublicVerdict } from "@/lib/verdict";

interface ScoreRailProps {
  verdict: PublicVerdict | null;
  score: number | null;
  className?: string;
}

/** Tier segment widths as percentages. BUILDING floor temporarily 20 — widths
 * follow current v2 calibration: FLAG 0-4 | INSUFF 5-19 | BUILDING 20-59 |
 * TRUSTED 60-79 | VERIFIED 80-100. Raise BUILDING floor with v3. */
const TIER_SEGMENTS: Array<{ pct: number; color: string; label: string }> = [
  { pct: 4,  color: "#ef4444", label: "FLAG" },
  { pct: 16, color: "#a1a1aa", label: "INSUFFICIENT" },
  { pct: 40, color: "#3b82f6", label: "BUILDING" },
  { pct: 20, color: "#22c55e", label: "TRUSTED" },
  { pct: 20, color: "#10b981", label: "VERIFIED" },
];

/** Clamp the chip translateX so it stays in-frame near edges. */
function chipOffset(pct: number): string {
  if (pct <= 10) return "0%";
  if (pct >= 90) return "-100%";
  return "-50%";
}

export function ScoreRail({ verdict, score, className }: ScoreRailProps) {
  const desc = verdictDescriptor(verdict);
  const s = score == null ? 0 : Math.max(0, Math.min(100, score));
  void desc; // reserved for future tier-specific styling

  return (
    <div className={cn("relative w-full py-4", className)} data-testid="score-rail">
      {/* Chip floating above */}
      <div
        className="absolute top-0 z-10"
        style={{ left: `${s}%`, transform: `translateX(${chipOffset(s)})` }}
      >
        <TrustStamp verdict={verdict} score={score} size="chip" />
      </div>

      {/* Segmented bar with dot marker */}
      <div className="mt-10 relative h-2.5 rounded-full overflow-hidden flex">
        {TIER_SEGMENTS.map(seg => (
          <div key={seg.label} style={{ width: `${seg.pct}%`, background: seg.color }} />
        ))}
        <div
          className="absolute top-1/2 w-[18px] h-[18px] rounded-full bg-white border border-zinc-900 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${s}%`, boxShadow: "0 0 0 3px rgba(0,0,0,0.35)" }}
          aria-hidden
        />
      </div>

      {/* Labels under each segment */}
      <div className="relative mt-2 flex text-[9px] font-extrabold tracking-wider text-muted-foreground">
        {TIER_SEGMENTS.map(seg => (
          <div key={seg.label} style={{ width: `${seg.pct}%` }} className="text-center">
            {seg.label}
          </div>
        ))}
      </div>
    </div>
  );
}
