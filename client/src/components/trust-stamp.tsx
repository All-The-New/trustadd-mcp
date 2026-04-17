import { cn } from "@/lib/utils";
import { verdictDescriptor, type PublicVerdict } from "@/lib/verdict";

export type TrustStampSize = "hero" | "square" | "chip";

interface TrustStampProps {
  verdict: PublicVerdict | null;
  score: number | null;
  size: TrustStampSize;
  methodologyVersion?: number;   // shown in hero meta row only
  scoredAt?: string | null;       // ISO date, shown in hero meta row only
  className?: string;
}

/** Shield lockup — inline SVG so it scales crisply and inherits currentColor. */
function ShieldLockup({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="6" fill="#0a59d0" />
      <path
        d="M16 5.5 L8 9.5 L8 15 C8 20.5 11.3 25.5 16 27 C20.7 25.5 24 20.5 24 15 L24 9.5 Z"
        fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

export function TrustStamp({ verdict, score, size, methodologyVersion, scoredAt, className }: TrustStampProps) {
  const desc = verdictDescriptor(verdict);
  const Icon = desc.icon;
  const displayScore = score == null ? "\u2014" : String(score);
  const isLongTier = desc.tier === "INSUFFICIENT";

  if (size === "hero") {
    return (
      <div
        className={cn("flex rounded-md overflow-hidden shadow-sm", className)}
        style={{ width: 256, height: 76, background: desc.tintBg }}
        data-testid="trust-stamp-hero"
        data-tier={desc.tier}
      >
        <div
          className="flex flex-col items-center justify-center shrink-0"
          style={{ width: 76, background: desc.color, color: "white" }}
        >
          <Icon className="w-8 h-8" strokeWidth={2} />
          <span className="mt-0.5 text-[21px] font-extrabold tabular-nums leading-none">{displayScore}</span>
        </div>
        <div className="flex-1 px-2.5 py-2 flex flex-col justify-between" style={{ color: desc.color }}>
          <div className="flex items-center gap-1">
            <ShieldLockup px={13} />
            <span className="text-[9px] font-extrabold tracking-[2px]" style={{ color: "#0a59d0" }}>TRUST RATING</span>
          </div>
          <div
            className={cn("font-black leading-none", isLongTier ? "text-[28px] tracking-normal" : "text-[31px] tracking-tight")}
          >
            {desc.label}
          </div>
          <div className="text-[8px] font-semibold tracking-wider opacity-70 flex items-center gap-1.5">
            <span>METHODOLOGY v{methodologyVersion ?? 2}</span>
            {scoredAt && <span>· {formatMonth(scoredAt)}</span>}
          </div>
        </div>
      </div>
    );
  }

  if (size === "square") {
    return (
      <div
        className={cn("flex flex-col rounded-md overflow-hidden shrink-0", className)}
        style={{ width: 64, height: 64, background: desc.tintBg }}
        data-testid="trust-stamp-square"
        data-tier={desc.tier}
      >
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: desc.color, color: "white", minHeight: 46 }}
        >
          <span className="text-[22px] font-extrabold tabular-nums leading-none">{displayScore}</span>
        </div>
        <div
          className={cn(
            "flex items-center justify-center font-black text-center",
            isLongTier ? "text-[8px] tracking-normal" : "text-[9px] tracking-[0.5px]",
          )}
          style={{ minHeight: 18, color: desc.color }}
        >
          {isLongTier ? desc.shortLabel : desc.label}
        </div>
      </div>
    );
  }

  // chip (32px tall, inline)
  return (
    <div
      className={cn("inline-flex items-center rounded-md overflow-hidden shrink-0", className)}
      style={{ height: 32, background: desc.tintBg }}
      data-testid="trust-stamp-chip"
      data-tier={desc.tier}
    >
      <div
        className="flex items-center gap-1 px-2 h-full"
        style={{ background: desc.color, color: "white" }}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="text-sm font-extrabold tabular-nums">{displayScore}</span>
      </div>
      <span
        className="px-2 text-[11px] font-black tracking-wider"
        style={{ color: desc.color }}
      >
        {isLongTier ? desc.shortLabel : desc.label}
      </span>
    </div>
  );
}
