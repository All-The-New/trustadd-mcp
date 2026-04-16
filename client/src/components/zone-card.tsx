import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ZoneState = "earned" | "populated" | "empty";

interface ZoneCardProps {
  state: ZoneState;
  label: string;
  statusTag?: string;  // e.g. "IPFS ✓", "DECLARED ✓", "NONE"
  children?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

/**
 * Zone-level activation per spec §6.
 *
 *   earned    → 3px green left-border, green dot next to label, status tag
 *   populated → plain label, no border (default card styling)
 *   empty     → 3px grey left-border, content muted to ~55%, "NONE" tag
 */
export function ZoneCard({ state, label, statusTag, children, className, ...rest }: ZoneCardProps) {
  const borderClass =
    state === "earned" ? "border-l-[3px] border-l-emerald-500"
    : state === "empty"  ? "border-l-[3px] border-l-muted-foreground/40"
    : "";

  return (
    <Card
      className={cn("p-4 relative", borderClass, state === "empty" && "opacity-[0.55]", className)}
      data-testid={rest["data-testid"]}
      data-zone-state={state}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {state === "earned" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden />}
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        {statusTag && (
          <span
            className={cn(
              "text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded",
              state === "earned" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
            )}
          >
            {statusTag}
          </span>
        )}
      </div>
      <div>{children}</div>
    </Card>
  );
}
