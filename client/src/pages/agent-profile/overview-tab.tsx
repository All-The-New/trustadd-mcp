import type { Agent } from "@shared/schema";
import { getChain, getExplorerAddressUrl } from "@shared/chains";
import { ZoneCard } from "@/components/zone-card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Globe, Zap } from "lucide-react";

interface Props { agent: Agent }

function formatUri(uri: string | null | undefined): { scheme: string; display: string } {
  if (!uri) return { scheme: "none", display: "—" };
  if (uri.startsWith("ipfs://")) return { scheme: "IPFS", display: uri };
  if (uri.startsWith("ar://"))   return { scheme: "Arweave", display: uri };
  return { scheme: "HTTPS", display: uri };
}

function normalizeEndpoints(e: unknown): Array<{ name: string; url: string }> {
  if (!e) return [];
  if (Array.isArray(e)) return e.map((x, i) => typeof x === "object" && x
    ? { name: (x as any).name ?? `Endpoint ${i + 1}`, url: (x as any).endpoint ?? (x as any).url ?? String(x) }
    : { name: `Endpoint ${i + 1}`, url: String(x) });
  if (typeof e === "object") return Object.entries(e as Record<string, unknown>).map(([k, v]) => ({ name: k, url: String(v) }));
  return [];
}

export function OverviewTab({ agent }: Props) {
  const chain = getChain(agent.chainId);
  const uri = formatUri(agent.metadataUri);
  const endpoints = normalizeEndpoints(agent.endpoints);
  const hasIpfs = uri.scheme === "IPFS" || uri.scheme === "Arweave";
  const hasSkills = (agent.oasfSkills?.length ?? 0) > 0 || (agent.oasfDomains?.length ?? 0) > 0;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ZoneCard state="populated" label="About" className="md:col-span-2" data-testid="zone-about">
        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-agent-description">
          {agent.description ?? "No description provided by this agent."}
        </p>
      </ZoneCard>

      <ZoneCard state="populated" label="Identity" data-testid="zone-identity">
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><dt className="w-24 text-muted-foreground">Chain</dt><dd>{chain?.name ?? "Unknown"}</dd></div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">Contract</dt>
            <dd className="font-mono flex items-center gap-1 truncate">
              {agent.primaryContractAddress.slice(0, 8)}…{agent.primaryContractAddress.slice(-6)}
              <a href={getExplorerAddressUrl(agent.chainId, agent.primaryContractAddress)} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-muted-foreground">Controller</dt>
            <dd className="font-mono flex items-center gap-1 truncate">
              {agent.controllerAddress.slice(0, 8)}…{agent.controllerAddress.slice(-6)}
              <a href={getExplorerAddressUrl(agent.chainId, agent.controllerAddress)} target="_blank" rel="noreferrer"><ExternalLink className="w-3 h-3" /></a>
            </dd>
          </div>
          <div className="flex gap-2"><dt className="w-24 text-muted-foreground">ERC-8004 ID</dt><dd className="font-mono">{agent.erc8004Id}</dd></div>
        </dl>
      </ZoneCard>

      <ZoneCard state="populated" label="Discovery" data-testid="zone-discovery">
        <dl className="text-sm space-y-1.5">
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">First Seen</dt><dd>Block {agent.firstSeenBlock.toLocaleString()}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Last Updated</dt><dd>Block {agent.lastUpdatedBlock.toLocaleString()}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Early Adopter</dt><dd>{new Date(agent.createdAt) < new Date("2026-06-01") ? "✓ Yes" : "— No"}</dd></div>
          <div className="flex gap-2"><dt className="w-40 text-muted-foreground">Active Maintainer</dt><dd>— No</dd></div>
        </dl>
      </ZoneCard>

      <ZoneCard
        state={hasIpfs ? "earned" : agent.metadataUri ? "populated" : "empty"}
        label="Metadata URI"
        statusTag={hasIpfs ? `${uri.scheme} ✓` : agent.metadataUri ? "HTTPS" : "NONE"}
        data-testid="zone-metadata-uri"
      >
        <p className="text-xs font-mono truncate">{uri.display}</p>
      </ZoneCard>

      <ZoneCard
        state={endpoints.length > 0 ? "populated" : "empty"}
        label="Public Links"
        statusTag={endpoints.length === 0 ? "NONE" : undefined}
        data-testid="zone-public-links"
      >
        {endpoints.length === 0
          ? <p className="text-xs text-muted-foreground">No endpoints declared.</p>
          : (
            <ul className="space-y-1.5 text-xs">
              {endpoints.map((ep, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Globe className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-medium text-muted-foreground shrink-0">{ep.name}</span>
                  <a href={ep.url.startsWith("http") ? ep.url : `https://${ep.url}`} target="_blank" rel="noreferrer" className="font-mono text-primary hover:underline truncate">{ep.url}</a>
                </li>
              ))}
            </ul>
          )}
      </ZoneCard>

      {agent.capabilities && agent.capabilities.length > 0 && (
        <ZoneCard state="populated" label="Declared Capabilities" className="md:col-span-2" data-testid="zone-capabilities">
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.map((c, i) => (
              <Badge key={i} variant="outline" className="text-xs"><Zap className="w-3 h-3 mr-1" />{c}</Badge>
            ))}
          </div>
        </ZoneCard>
      )}

      <ZoneCard
        state={hasSkills ? "earned" : "empty"}
        label="OASF Skills"
        statusTag={hasSkills ? "DECLARED ✓" : "NONE"}
        className="md:col-span-2"
        data-testid="zone-oasf-skills"
      >
        {hasSkills ? (
          <div className="flex flex-wrap gap-1.5">
            {[...(agent.oasfSkills ?? []), ...(agent.oasfDomains ?? [])].map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">No OASF skills declared.</p>}
      </ZoneCard>
    </div>
  );
}
