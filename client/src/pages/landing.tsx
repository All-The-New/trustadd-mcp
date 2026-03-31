import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Agent } from "@shared/schema";
import { HOME, SEO as SEO_CONTENT } from "@/lib/content-zones";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { AgentCard, AgentCardSkeleton } from "@/components/agent-card";
import { StatsBar } from "@/components/stats-bar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  ArrowRight,
  Eye,
  Layers,
  Globe,
  Bot,
  Star,
  Trophy,
  Clock,
} from "lucide-react";

const featureIcons = { Layers, Shield, Bot } as const;
const pillarIcons = { Shield, Star, Eye } as const;

type AgentsResponse = {
  agents: Agent[];
  total: number;
  communityFeedback?: Record<string, { githubStars: number | null; githubHealthScore: number | null; farcasterFollowers: number | null }>;
};

export default function Landing() {
  const { data: recentData, isLoading: recentLoading } = useQuery<AgentsResponse>({
    queryKey: ["/api/agents", { limit: 10, filter: "has-metadata", sort: "newest" }],
    queryFn: () => fetch("/api/agents?limit=10&filter=has-metadata&sort=newest").then((r) => r.json()),
  });

  const { data: topData, isLoading: topLoading } = useQuery<AgentsResponse>({
    queryKey: ["/api/agents", { limit: 10, filter: "has-metadata", sort: "trust-score" }],
    queryFn: () => fetch("/api/agents?limit=10&filter=has-metadata&sort=trust-score").then((r) => r.json()),
  });

  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalAgents: number;
    totalEvents: number;
    lastProcessedBlock: number;
    newAgents24h?: number;
    isIndexerRunning?: boolean;
    chainBreakdown?: Array<{ chainId: number; totalAgents: number; totalEvents: number; lastProcessedBlock: number }>;
  }>({
    queryKey: ["/api/stats"],
    refetchInterval: 60_000,
  });

  const recentAgents = recentData?.agents ?? [];
  const topAgents = topData?.agents ?? [];

  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.landing.title}
        description={SEO_CONTENT.landing.description}
        path="/"
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-20">
          <div className="grid md:grid-cols-2 gap-0 items-stretch border border-border/50 rounded-lg bg-card/40 overflow-hidden">
            <div className="p-6 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{HOME.hero.tag}</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter leading-[1.1]" data-testid="text-hero-title">
                {HOME.hero.title}
                <br />
                <span className="text-primary">{HOME.hero.titleAccent}</span>
              </h1>

              <p className="text-sm sm:text-base text-muted-foreground mt-4 max-w-md leading-relaxed">
                {HOME.hero.subtitle}
              </p>

              <div className="flex items-center gap-3 mt-6 flex-wrap">
                <Link href="/agents">
                  <Button className="gap-2" data-testid="button-explore-agents">
                    <Bot className="w-4 h-4" />
                    {HOME.hero.ctaPrimary}
                  </Button>
                </Link>
                <Link href="/api-docs">
                  <Button variant="outline" className="gap-2" data-testid="button-view-api">
                    <Globe className="w-4 h-4" />
                    {HOME.hero.ctaSecondary}
                  </Button>
                </Link>
              </div>
            </div>

            <div className="hidden md:flex flex-col justify-between gap-3 p-6 sm:p-8 md:border-l border-t md:border-t-0 border-border/50 bg-muted/20">
              {HOME.features.map((item) => {
                const Icon = featureIcons[item.icon];
                return (
                  <div key={item.title} className="p-4 rounded-md bg-background/60 border border-border/40 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                      <h3 className="font-semibold text-sm">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pl-6">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="w-full border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <StatsBar stats={stats} isLoading={statsLoading} />
        </div>
      </section>

      {/* Agent Lists: Top Trusted + Recently Discovered */}
      <section className="mx-auto max-w-6xl px-4 py-10" data-testid="section-agent-lists">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          {/* Top Trusted Agents — inner lists use flex-col because this outer grid already provides the 2-column layout */}
          <div data-testid="section-top-trusted">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h2 className="text-lg font-semibold tracking-tight">{HOME.topTrusted.heading}</h2>
              </div>
              <Link href="/agents">
                <Button variant="ghost" className="gap-1 text-sm" data-testid="link-view-leaderboard">
                  {HOME.topTrusted.viewAll}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-3" data-testid="grid-top-trusted">
              {topLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <AgentCardSkeleton key={i} />
                ))
              ) : topAgents.length > 0 ? (
                topAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                  />
                ))
              ) : (
                <Card className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Trophy className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">{HOME.topTrusted.emptyState}</p>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Recently Discovered */}
          <div data-testid="section-recently-discovered">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h2 className="text-lg font-semibold tracking-tight">{HOME.recentlyDiscovered.heading}</h2>
              </div>
              <Link href="/agents">
                <Button variant="ghost" className="gap-1 text-sm" data-testid="link-view-all-agents">
                  {HOME.recentlyDiscovered.viewAll}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-3" data-testid="list-agents">
              {recentLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <AgentCardSkeleton key={i} />
                ))
              ) : recentAgents.length > 0 ? (
                recentAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                  />
                ))
              ) : (
                <Card className="p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Bot className="w-10 h-10 text-muted-foreground mb-3" />
                    <h3 className="font-semibold text-sm mb-1">No agents discovered yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {HOME.emptyState}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Three Pillars */}
      <section className="mx-auto max-w-6xl px-4 py-8" data-testid="section-protocol-education">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold tracking-tight">{HOME.pillars.heading}</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl mx-auto leading-relaxed">
            {HOME.pillars.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {HOME.pillars.items.map((pillar) => {
            const Icon = pillarIcons[pillar.icon];
            const badgeClass =
              pillar.badgeVariant === "live"
                ? "bg-green-500/15 text-green-700 dark:text-green-400 no-default-hover-elevate no-default-active-elevate"
                : pillar.badgeVariant === "monitoring"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate"
                  : "no-default-hover-elevate no-default-active-elevate";
            return (
              <Card key={pillar.title} className="p-5" data-testid={`card-pillar-${pillar.title.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm">{pillar.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  {pillar.desc}
                </p>
                <Badge className={badgeClass}>{pillar.badge}</Badge>
              </Card>
            );
          })}
        </div>
      </section>

      {/* API CTA */}
      <section className="mx-auto max-w-6xl px-4 py-8 pb-16">
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-sm">{HOME.api.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {HOME.api.desc}
              </p>
            </div>
            <Link href="/api-docs">
              <Button variant="outline" className="gap-2" data-testid="link-api-docs-footer">
                <Globe className="w-4 h-4" />
                {HOME.api.cta}
              </Button>
            </Link>
          </div>
        </Card>
      </section>
    </Layout>
  );
}
