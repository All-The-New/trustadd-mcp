import { User, Activity, Users, Shield, ShieldAlert } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface CategoryStrengths {
  identity: "high" | "medium" | "low" | "none";
  behavioral: "high" | "medium" | "low" | "none";
  community: "high" | "medium" | "low" | "none";
  attestation: "high" | "medium" | "low" | "none";
  authenticity: "high" | "medium" | "low" | "none";
}

const ROWS: Array<{
  key: keyof CategoryStrengths;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  tooltip: string;
}> = [
  { key: "identity",     label: "Identity",     icon: User,        color: "#3b82f6",
    tooltip: "Controller, metadata, on-chain identity signals." },
  { key: "behavioral",   label: "Behavioral",   icon: Activity,    color: "#22c55e",
    tooltip: "Transaction patterns, payment cadence, and activity consistency." },
  { key: "community",    label: "Community",    icon: Users,       color: "#a855f7",
    tooltip: "GitHub health, Farcaster presence, external reputation." },
  { key: "attestation",  label: "Attestation",  icon: Shield,      color: "#f59e0b",
    tooltip: "Third-party verifications via on-chain attestation. Inactive in v2, scheduled for v3." },
  { key: "authenticity", label: "Authenticity", icon: ShieldAlert, color: "#ef4444",
    tooltip: "Detection of coordinated agent networks (Sybil resistance)." },
];

const STRENGTH_WIDTH = { high: 85, medium: 55, low: 25, none: 5 };

interface CategoryBarsProps {
  strengths: CategoryStrengths;
  className?: string;
}

export function CategoryBars({ strengths, className }: CategoryBarsProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="category-bars">
      {ROWS.map(row => {
        const Icon = row.icon;
        const strength = strengths[row.key];
        const width = STRENGTH_WIDTH[strength];
        return (
          <div key={row.key} className="flex items-center gap-3" data-testid={`category-${row.key}`}>
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: `${row.color}20`, color: row.color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-sm font-semibold">{row.label}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-[10px] text-muted-foreground cursor-help" aria-label="info">ⓘ</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">{row.tooltip}</TooltipContent>
                </Tooltip>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${width}%`, background: row.color }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
