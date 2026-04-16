import type { Agent } from "@shared/schema";
import { useState } from "react";
import { getChain } from "@shared/chains";
import { TrustStamp } from "@/components/trust-stamp";
import { addressToGradientPair } from "@/lib/address-color";
import type { PublicVerdict } from "@/lib/verdict";
import { cn } from "@/lib/utils";

interface BannerProps {
  agent: Agent & { verdict?: PublicVerdict };
  verdict: PublicVerdict;
  updatedAt: string | null;
}

function shortAddress(a: string): string { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

function ImageTile({ agent }: { agent: Agent }) {
  const { a, b } = addressToGradientPair(agent.controllerAddress);
  const [imgFailed, setImgFailed] = useState(false);
  const hasImage = !!agent.imageUrl && !imgFailed;
  return (
    <div
      className="relative flex-shrink-0 rounded-xl overflow-hidden"
      style={{ width: 160, height: 160, background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {hasImage ? (
        <img
          src={agent.imageUrl!}
          alt={agent.name ?? "Agent image"}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-5xl opacity-20 select-none" aria-hidden>🤖</span>
        </div>
      )}
    </div>
  );
}

function IdentityChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-black/35 border border-white/15 backdrop-blur-sm whitespace-nowrap",
        "text-white/85",
      )}
    >
      <span className="opacity-60 text-[8px] uppercase tracking-wider">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </span>
  );
}

function BannerDesktop({ agent, verdict, updatedAt }: BannerProps) {
  const chain = getChain(agent.chainId);
  const { a, b } = addressToGradientPair(agent.controllerAddress);
  const eyebrow = `${(agent as any).qualityTier?.toUpperCase() ?? "UNCLASSIFIED"} · Active since ${
    new Date(agent.createdAt).toLocaleString("en-US", { month: "short", year: "numeric" })
  }`;
  const score = (agent as any).trustScore ?? null;

  return (
    <div
      className="hidden sm:flex rounded-lg overflow-hidden p-[22px] gap-5 mb-4"
      style={{
        background: `radial-gradient(ellipse at 20% 30%, ${a} 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, ${b} 0%, #0b0e17 70%)`,
        minHeight: 204,
      }}
      data-testid="banner-desktop"
    >
      <ImageTile agent={agent} />
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-[2px] text-white/75 mb-2">{eyebrow}</div>
          <h1 className="text-white text-[34px] font-extrabold truncate" title={agent.name ?? `Agent #${agent.erc8004Id}`}>
            {agent.name ?? `Agent #${agent.erc8004Id}`}
          </h1>
        </div>
        <div className="flex items-stretch gap-4">
          <div className="flex-1 min-w-0 flex flex-col gap-3 justify-between">
            <p className="text-white/90 text-[13px] leading-relaxed line-clamp-2">
              {agent.description ?? "No description provided by this agent."}
            </p>
            <div className="flex flex-nowrap items-center gap-2 overflow-hidden">
              {chain && <IdentityChip label="CHAIN" value={chain.name} />}
              <IdentityChip label="ID" value={agent.erc8004Id} mono />
              <IdentityChip label="CONTRACT" value={shortAddress(agent.primaryContractAddress)} mono />
              <IdentityChip label="CONTROLLER" value={shortAddress(agent.controllerAddress)} mono />
            </div>
          </div>
          <div className="shrink-0 self-end">
            <TrustStamp verdict={verdict} score={score} size="hero" methodologyVersion={2} scoredAt={updatedAt} />
          </div>
        </div>
      </div>
    </div>
  );
}

function BannerMobile({ agent, verdict, updatedAt }: BannerProps) {
  const score = (agent as any).trustScore ?? null;
  const chain = getChain(agent.chainId);
  const { a } = addressToGradientPair(agent.controllerAddress);
  const [expanded, setExpanded] = useState(false);
  const eyebrow = ((agent as any).qualityTier?.toUpperCase() ?? "UNCLASSIFIED");
  return (
    <div
      className="sm:hidden rounded-lg overflow-hidden p-4 mb-4 flex flex-col gap-3"
      style={{ background: `radial-gradient(ellipse at 0% 0%, ${a}, #0b0e17)` }}
      data-testid="banner-mobile"
    >
      <div className="flex items-center gap-3 h-[64px]">
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-muted">
          {agent.imageUrl ? (
            <img src={agent.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : <div className="w-full h-full flex items-center justify-center text-2xl opacity-30">🤖</div>}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ height: 64 }}>
          <div className="text-[9px] uppercase font-bold tracking-[2px] text-white/70 truncate">{eyebrow}</div>
          <h1 className="text-white text-[17px] font-extrabold leading-[1.2] line-clamp-2" style={{ wordBreak: "break-word" }}>
            {agent.name ?? `Agent #${agent.erc8004Id}`}
          </h1>
        </div>
      </div>
      <p className="text-white/85 text-[11px] leading-[1.45]" style={expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {agent.description ?? "No description provided."}
        {agent.description && !expanded && (
          <button onClick={() => setExpanded(true)} className="ml-1 text-blue-300 uppercase text-[10px] font-bold" data-testid="banner-more">MORE</button>
        )}
      </p>
      <TrustStamp verdict={verdict} score={score} size="hero" methodologyVersion={2} scoredAt={updatedAt} className="w-full" />
      <div className="flex flex-wrap gap-1.5">
        {chain && <IdentityChip label="CHAIN" value={chain.name} />}
        <IdentityChip label="ID" value={agent.erc8004Id} mono />
        <IdentityChip label="CONTRACT" value={shortAddress(agent.primaryContractAddress)} mono />
      </div>
    </div>
  );
}

export function Banner(props: BannerProps) {
  return (
    <>
      <BannerDesktop {...props} />
      <BannerMobile {...props} />
    </>
  );
}
