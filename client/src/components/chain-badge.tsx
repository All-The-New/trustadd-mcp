import { Badge } from "@/components/ui/badge";
import { getChain, type ChainConfig } from "@shared/chains";

interface ChainBadgeProps {
  chainId: number;
  size?: "sm" | "md";
}

export function ChainBadge({ chainId, size = "sm" }: ChainBadgeProps) {
  const chain = getChain(chainId);
  if (!chain) return null;

  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

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
          width: size === "sm" ? "12px" : "14px",
          height: size === "sm" ? "12px" : "14px",
          fontSize: size === "sm" ? "8px" : "9px",
        }}
      >
        {chain.iconLetter}
      </span>
      {chain.name}
    </Badge>
  );
}
