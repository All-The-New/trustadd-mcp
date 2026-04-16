import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Canonical priority order — earned-first, matches spec §8. */
export const VERIFICATION_PRIORITY: ReadonlyArray<{ name: string; label: string }> = [
  { name: "First Transaction", label: "1st Tx" },
  { name: "x402 Enabled",      label: "x402" },
  { name: "GitHub Connected",  label: "GitHub" },
  { name: "IPFS Metadata",     label: "IPFS" },
  { name: "OASF Skills",       label: "OASF" },
  { name: "Active Maintainer", label: "Active" },
  { name: "Farcaster Connected", label: "Farcaster" },
  { name: "Multi-Chain",       label: "Multi" },
  { name: "Early Adopter",     label: "Early" },
];

export interface EarnedVerification { name: string; earned: boolean }

/** Pure: given chip widths, available width, gap, and "+N" reserve, return how many to show. */
export function computeVisibleCount(
  widths: number[],
  available: number,
  gap: number,
  overflowReserve: number,
): { visible: number; droppedCount: number } {
  if (widths.length === 0) return { visible: 0, droppedCount: 0 };
  // Try to fit all first
  const allWithGap = widths.reduce((a, w, i) => a + w + (i === 0 ? 0 : gap), 0);
  if (allWithGap <= available) return { visible: widths.length, droppedCount: 0 };

  // Otherwise reserve room for the overflow pill and accumulate one at a time
  let used = 0;
  let visible = 0;
  for (let i = 0; i < widths.length; i++) {
    const extra = widths[i] + (visible === 0 ? 0 : gap);
    if (used + extra + gap + overflowReserve <= available) {
      used += extra;
      visible++;
    } else break;
  }
  return { visible, droppedCount: widths.length - visible };
}

interface VerificationChipsProps {
  verifications: EarnedVerification[];
  addressChip?: React.ReactNode;  // e.g. shortened address badge rendered by caller
  onOverflowClick?: () => void;
  className?: string;
}

/**
 * Renders chips in priority order. Uses a hidden measurement pass to compute
 * widths, then renders the visible subset + "+N more" if anything dropped.
 */
export function VerificationChips({ verifications, addressChip, onOverflowClick, className }: VerificationChipsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number>(verifications.length);
  const [dropped, setDropped] = useState<number>(0);

  const earnedByPriority = VERIFICATION_PRIORITY
    .filter(p => verifications.find(v => v.name === p.name && v.earned));

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const recalc = () => {
      const chipNodes = measure.querySelectorAll<HTMLElement>("[data-chip]");
      const widths = Array.from(chipNodes).map(n => n.offsetWidth);
      const available = container.offsetWidth - (addressChip ? 72 : 0); // ~72px reserve for address
      const { visible, droppedCount } = computeVisibleCount(widths, available, 5, 52);
      setVisible(visible);
      setDropped(droppedCount);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(container);
    return () => ro.disconnect();
  }, [earnedByPriority.length, addressChip]);

  const shown = earnedByPriority.slice(0, visible);

  return (
    <div ref={containerRef} className={cn("flex items-center gap-[5px] w-full", className)} data-testid="verification-chips">
      {addressChip}
      {/* Visible chips */}
      {shown.map(p => (
        <span
          key={p.name}
          className="text-[10px] font-semibold px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap"
          data-testid={`chip-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
        >
          ✓ {p.label}
        </span>
      ))}
      {dropped > 0 && (
        <button
          type="button"
          onClick={onOverflowClick}
          className="text-[10px] font-semibold px-2 py-1 rounded bg-muted text-muted-foreground border border-border whitespace-nowrap hover:bg-muted/80"
          data-testid="chip-overflow"
        >
          +{dropped} more
        </button>
      )}
      {/* Hidden measurement pass — renders all earned chips off-screen */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute -left-[9999px] top-0 flex items-center gap-[5px] pointer-events-none"
      >
        {earnedByPriority.map(p => (
          <span
            key={p.name}
            data-chip
            className="text-[10px] font-semibold px-2 py-1 rounded border whitespace-nowrap"
          >
            ✓ {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
