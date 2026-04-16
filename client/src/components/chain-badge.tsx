import { Badge } from "@/components/ui/badge";
import { getChain } from "@shared/chains";

interface ChainBadgeProps {
  chainId: number;
  size?: "sm" | "md";
  /** When `true`, render count-only (`⬡ 5c`) — use on narrow viewports. */
  short?: boolean;
  /** Optional extra-chain count to display as `+N`. Ignored when `short`. */
  extraChainCount?: number;
}

export function ChainBadge({ chainId, size = "sm", short, extraChainCount }: ChainBadgeProps) {
  const chain = getChain(chainId);
  if (!chain) return null;

  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (short) {
    const count = (extraChainCount ?? 0) + 1;
    return (
      <Badge
        className={`${textSize} no-default-hover-elevate no-default-active-elevate gap-1`}
        style={{ backgroundColor: chain.bgColor, color: chain.color }}
        data-testid={`badge-chain-${chain.shortName}`}
      >
        <span
          className="inline-flex items-center justify-center rounded-full font-bold"
          style={{ backgroundColor: chain.color, color: "white", width: 12, height: 12, fontSize: 8 }}
        >
          {chain.iconLetter}
        </span>
        {count}c
      </Badge>
    );
  }

  return (
    <Badge
      className={`${textSize} no-default-hover-elevate no-default-active-elevate gap-1`}
      style={{ backgroundColor: chain.bgColor, color: chain.color }}
      data-testid={`badge-chain-${chain.shortName}`}
    >
      <span
        className="inline-flex items-center justify-center rounded-full font-bold"
        style={{
          backgroundColor: chain.color,
          color: "white",
          width: size === "sm" ? 12 : 14,
          height: size === "sm" ? 12 : 14,
          fontSize: size === "sm" ? 8 : 9,
        }}
      >
        {chain.iconLetter}
      </span>
      {chain.name}
      {extraChainCount ? ` +${extraChainCount}` : ""}
    </Badge>
  );
}
