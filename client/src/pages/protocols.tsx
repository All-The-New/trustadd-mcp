import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ChainBadge } from "@/components/chain-badge";
import { getChain } from "@shared/chains";
import {
  Shield,
  Zap,
  FileCode,
  Wrench,
  Network,
  Layers,
  ArrowRight,
  CheckCircle2,
  Radio,
  Bot,
  ShieldCheck,
  Globe,
  Info,
  ListChecks,
  Activity,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { PROTOCOLS, SEO as SEO_CONTENT } from "@/lib/content-zones";

const ICON_MAP: Record<string, LucideIcon> = {
  Shield,
  Zap,
  FileCode,
  Wrench,
  Network,
};

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: LucideIcon }> = {
  live: { label: "Live", variant: "default", icon: CheckCircle2 },
  tracking: { label: "Tracking", variant: "outline", icon: Radio },
};

interface ProtocolStats {
  totalAgents: number;
  withMetadata: number;
  totalEvents: number;
  chainCount: number;
  erc8004: { registered: number; withMetadata: number; totalEvents: number; chainBreakdown: Array<{ chainId: number; count: number }> };
  x402: { enabled: number; adoptionRate: number; chainBreakdown: Array<{ chainId: number; count: number }> };
  oasf: { withSkills: number; withDomains: number; topSkillCategories: string[] };
  mcp: { declaring: number; adoptionRate: number };
  a2a: { declaring: number; adoptionRate: number };
}

function MiniRing({ value, max, size = 36 }: { value: number; max: number; size?: number }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  const deg = pct * 3.6;
  return (
    <div
      className="relative rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(hsl(var(--primary)) ${deg}deg, hsl(var(--muted)) ${deg}deg)`,
      }}
      data-testid="mini-ring"
    >
      <div className="absolute rounded-full bg-background" style={{ inset: size * 0.2 }} />
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tabular-nums"
        style={{ fontSize: size * 0.28 }}
      >
        {pct}%
      </span>
    </div>
  );
}

function ProgressBar({ value, max, className = "" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div className={`w-full bg-muted rounded-full h-2 ${className}`}>
      <div
        className="bg-primary rounded-full h-2 transition-all duration-500"
        style={{ width: `${pct}%` }}
        data-testid="progress-bar-fill"
      />
    </div>
  );
}

function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
        <Icon className="w-3.5 h-3.5 text-primary" />
      </div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function StatTile({ label, value, sub, ring }: { label: string; value: string | number; sub?: string; ring?: { value: number; max: number } }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-lg font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
        </div>
        {ring && <MiniRing value={ring.value} max={ring.max} size={40} />}
      </div>
    </div>
  );
}

function ChainCoverageBar({ chainBreakdown, max, label }: { chainBreakdown: Array<{ chainId: number; count: number }>; max: number; label?: string }) {
  const sorted = [...chainBreakdown].sort((a, b) => b.count - a.count);
  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      {label && (
        <SectionHeader icon={Globe} label={label} />
      )}
      <div className="space-y-1.5">
        {sorted.map((cb) => {
          const chain = getChain(cb.chainId);
          return (
            <div key={cb.chainId} className="flex items-center justify-between gap-2">
              <div className="w-20 flex-shrink-0">
                <ChainBadge chainId={cb.chainId} size="sm" />
              </div>
              <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="rounded-full h-2 transition-all duration-500"
                    style={{
                      width: `${max > 0 ? Math.min(Math.round((cb.count / max) * 100), 100) : 0}%`,
                      backgroundColor: chain?.color ?? "hsl(var(--primary))",
                    }}
                  />
                </div>
                <span className="text-xs tabular-nums font-medium w-10 text-right">{cb.count.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProtocolUsagePanel({ protocolId, stats }: { protocolId: string; stats: ProtocolStats | undefined }) {
  if (!stats) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  const total = stats.totalAgents;

  if (protocolId === "erc-8004") {
    const metaPct = total > 0 ? Math.round((stats.erc8004.withMetadata / total) * 100) : 0;
    return (
      <div className="space-y-3" data-testid="usage-panel-erc-8004">
        <SectionHeader icon={Activity} label="Live Usage" />
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Agents Registered" value={stats.erc8004.registered} />
          <StatTile
            label="With Full Metadata"
            value={stats.erc8004.withMetadata}
            sub={`${metaPct}% of total`}
            ring={{ value: stats.erc8004.withMetadata, max: total }}
          />
        </div>
        <ChainCoverageBar chainBreakdown={stats.erc8004.chainBreakdown} max={total} label="Chain Coverage" />
      </div>
    );
  }

  if (protocolId === "x402") {
    return (
      <div className="space-y-3" data-testid="usage-panel-x402">
        <SectionHeader icon={Activity} label="Live Usage" />
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="x402 Enabled"
            value={stats.x402.enabled}
            ring={{ value: stats.x402.enabled, max: total }}
          />
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-1.5">Adoption Rate</p>
            <p className="text-lg font-semibold tabular-nums mb-1">{stats.x402.adoptionRate}%</p>
            <ProgressBar value={stats.x402.enabled} max={total} />
          </div>
        </div>
        {stats.x402.chainBreakdown.length > 0 && (
          <ChainCoverageBar chainBreakdown={stats.x402.chainBreakdown} max={stats.x402.enabled} label="Chain Breakdown" />
        )}
      </div>
    );
  }

  if (protocolId === "oasf") {
    const skillsPct = total > 0 ? Math.round((stats.oasf.withSkills / total) * 100) : 0;
    const domainsPct = total > 0 ? Math.round((stats.oasf.withDomains / total) * 100) : 0;
    return (
      <div className="space-y-3" data-testid="usage-panel-oasf">
        <SectionHeader icon={Activity} label="Live Usage" />
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            label="With Declared Skills"
            value={stats.oasf.withSkills}
            sub={`${skillsPct}% of agents`}
            ring={{ value: stats.oasf.withSkills, max: total }}
          />
          <StatTile
            label="With Domain Declarations"
            value={stats.oasf.withDomains}
            sub={`${domainsPct}% of agents`}
            ring={{ value: stats.oasf.withDomains, max: total }}
          />
        </div>
        {stats.oasf.topSkillCategories.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Top Skill Categories</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.oasf.topSkillCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (protocolId === "mcp") {
    return (
      <div className="space-y-3" data-testid="usage-panel-mcp">
        <SectionHeader icon={Activity} label="Live Usage" />
        <StatTile
          label="MCP Support Declared"
          value={stats.mcp.declaring}
          sub={`${stats.mcp.adoptionRate}% of agents`}
          ring={{ value: stats.mcp.declaring, max: total }}
        />
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Adoption Progress</p>
          <ProgressBar value={stats.mcp.declaring} max={total} />
          <p className="text-xs text-muted-foreground/70">{stats.mcp.declaring} of {total.toLocaleString()} agents</p>
        </div>
      </div>
    );
  }

  if (protocolId === "a2a") {
    return (
      <div className="space-y-3" data-testid="usage-panel-a2a">
        <SectionHeader icon={Activity} label="Live Usage" />
        <StatTile
          label="A2A Support Declared"
          value={stats.a2a.declaring}
          sub={`${stats.a2a.adoptionRate}% of agents`}
          ring={{ value: stats.a2a.declaring, max: total }}
        />
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium">Adoption Progress</p>
          <ProgressBar value={stats.a2a.declaring} max={total} />
          <p className="text-xs text-muted-foreground/70">{stats.a2a.declaring} of {total.toLocaleString()} agents</p>
        </div>
      </div>
    );
  }

  return null;
}

function HowItWorksStepper({ text }: { text: string }) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const steps = [];
  for (let i = 0; i < sentences.length; i += Math.max(1, Math.ceil(sentences.length / 3))) {
    steps.push(sentences.slice(i, i + Math.max(1, Math.ceil(sentences.length / 3))).join("").trim());
  }
  if (steps.length === 0) steps.push(text);

  return (
    <div className="relative pl-8 space-y-3">
      <div className="absolute left-3 top-3 bottom-1 w-px bg-border" />
      {steps.map((step, i) => (
        <div key={i} className="relative flex items-start gap-3">
          <div className="absolute -left-8 flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
            {i + 1}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
        </div>
      ))}
    </div>
  );
}

function ProtocolCard({ protocol, stats }: { protocol: (typeof PROTOCOLS.items)[number]; stats: ProtocolStats | undefined }) {
  const Icon = ICON_MAP[protocol.icon] || Shield;
  const status = STATUS_CONFIG[protocol.status] || STATUS_CONFIG.tracking;
  const StatusIcon = status.icon;

  return (
    <Card data-testid={`card-protocol-${protocol.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold" data-testid={`text-protocol-name-${protocol.id}`}>
                {protocol.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground font-medium">{protocol.tagline}</p>
            </div>
          </div>
          <Badge
            variant={status.variant === "default" ? "default" : "outline"}
            className="gap-1 shrink-0"
            data-testid={`badge-protocol-status-${protocol.id}`}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="rounded-md bg-muted/20 p-3 space-y-2">
              <SectionHeader icon={Info} label="About" />
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`text-protocol-desc-${protocol.id}`}>
                {protocol.description}
              </p>
            </div>

            <div className="rounded-md bg-muted/20 p-3 space-y-2">
              <SectionHeader icon={Layers} label="How It Works" />
              <HowItWorksStepper text={protocol.howItWorks} />
            </div>

            <div className="rounded-md bg-muted/20 p-3 space-y-2">
              <SectionHeader icon={ListChecks} label="What TrustAdd Tracks" />
              <ul className="space-y-1.5">
                {protocol.whatWeTrack.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          <div className="md:border-l md:pl-6 space-y-3">
            <ProtocolUsagePanel protocolId={protocol.id} stats={stats} />
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <SectionHeader icon={BarChart3} label="Score Categories" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {protocol.scoreCategories.map((cat) => (
                  <Badge key={cat} variant="secondary" className="text-xs">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Protocols() {
  const { data: protocolStats, isLoading: statsLoading } = useQuery<ProtocolStats>({
    queryKey: ["/api/analytics/protocol-stats"],
  });

  const agentCount = protocolStats?.totalAgents;
  const withMetadata = protocolStats?.withMetadata;
  const metadataPct = agentCount && withMetadata != null ? Math.round((withMetadata / agentCount) * 100) : 0;
  const protocolCount = PROTOCOLS.items.length;
  const chainCount = protocolStats?.chainCount;

  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.protocols.title}
        description={SEO_CONTENT.protocols.description}
        path="/protocols"
      />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-protocols-title">
                {PROTOCOLS.pageTitle}
              </h1>
              <p className="text-muted-foreground text-sm">
                {PROTOCOLS.pageSubtitle}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="section-protocols-summary">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Agents Indexed</span>
            </div>
            {statsLoading ? (
              <div className="h-6 w-16 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-xl font-semibold tabular-nums mt-1" data-testid="stat-protocols-agents">
                {agentCount != null ? agentCount.toLocaleString() : "---"}
              </p>
            )}
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">TrustAdd Verified</span>
            </div>
            {statsLoading ? (
              <div className="h-6 w-16 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-xl font-semibold tabular-nums mt-1" data-testid="stat-protocols-metadata">
                {withMetadata != null ? `${withMetadata.toLocaleString()} · ${metadataPct}%` : "---"}
              </p>
            )}
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Protocols Supported</span>
            </div>
            <p className="text-xl font-semibold tabular-nums mt-1" data-testid="stat-protocols-count">
              {protocolCount}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">Active Chains</span>
            </div>
            {statsLoading ? (
              <div className="h-6 w-16 bg-muted animate-pulse rounded mt-1" />
            ) : (
              <p className="text-xl font-semibold tabular-nums mt-1" data-testid="stat-protocols-chains">
                {chainCount ?? "---"}
              </p>
            )}
          </Card>
        </div>

        <section className="space-y-4" data-testid="section-protocols-list">
          {PROTOCOLS.items.map((protocol) => (
            <ProtocolCard key={protocol.id} protocol={protocol} stats={protocolStats} />
          ))}
        </section>

        <section className="space-y-4" data-testid="section-emerging-standards">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">{PROTOCOLS.emerging.title}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed text-sm">
            {PROTOCOLS.emerging.description}
          </p>
          <Card>
            <CardContent className="pt-4">
              <ul className="space-y-2">
                {PROTOCOLS.emerging.items.map((item, i) => {
                  const [name, ...descParts] = item.split(" — ");
                  const desc = descParts.join(" — ");
                  return (
                    <li key={i} className="flex items-start gap-2 text-sm" data-testid={`emerging-item-${i}`}>
                      <Radio className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-foreground">{name}</strong>
                        {desc && <span className="text-muted-foreground"> — {desc}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-lg border bg-muted/30 p-6 space-y-3" data-testid="section-protocols-cta">
          <h3 className="text-lg font-semibold">Explore Agent Data</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            See how these protocols come together in practice. Browse the agent directory to view trust scores, or use the API to integrate protocol data into your own applications.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/agents">
              <Button className="gap-2" data-testid="link-protocols-directory">
                Browse Agents
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/api-docs">
              <Button variant="outline" className="gap-2" data-testid="link-protocols-api">
                View API Docs
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/economy">
              <Button variant="outline" className="gap-2" data-testid="link-protocols-economy">
                Agent Economy
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
