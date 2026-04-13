import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Clock,
  Zap,
  Users,
  Eye,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { METHODOLOGY, SEO as SEO_CONTENT } from "@/lib/content-zones";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Clock,
  Zap,
  Users,
  Eye,
};

const VERDICT_CONFIG = [
  {
    verdict: "TRUSTED",
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
    description: "Score 60 or above, quality tier is high or medium, and no spam flags. The agent has a well-established on-chain identity with strong signals across multiple categories.",
    criteria: ["Score \u2265 60", "Quality tier: high or medium", "No spam flags"],
  },
  {
    verdict: "CAUTION",
    icon: AlertTriangle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    description: "The agent has some positive signals but doesn't meet all criteria for TRUSTED. May be new, have limited metadata, or lack community signals.",
    criteria: ["Score 30\u201359, or", "Score \u2265 60 but missing tier/flag criteria"],
  },
  {
    verdict: "UNTRUSTED",
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
    description: "Very low trust signals, classified as spam or archived, or the agent's lifecycle status indicates it's no longer active.",
    criteria: ["Score < 30, or", "Quality tier: spam or archived, or", "Lifecycle status: archived"],
  },
  {
    verdict: "UNKNOWN",
    icon: HelpCircle,
    color: "text-muted-foreground",
    bg: "bg-muted/30 border-border",
    description: "The agent hasn't been scored yet. This typically means it was recently discovered and is awaiting its first scoring pass.",
    criteria: ["No trust score calculated yet"],
  },
];

export default function Methodology() {
  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.methodology.title}
        description={SEO_CONTENT.methodology.description}
        path="/methodology"
      />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {METHODOLOGY.header.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg leading-relaxed max-w-2xl">
            {METHODOLOGY.header.subtitle}
          </p>
        </div>

        {/* Overview */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{METHODOLOGY.overview.title}</h2>
          <div className="text-muted-foreground space-y-3 leading-relaxed">
            {METHODOLOGY.overview.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* Score bar visualization */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Score Composition</h2>
          <p className="text-muted-foreground leading-relaxed">
            The TrustAdd Score ranges from 0 to 100, composed of five weighted categories. Each category has a maximum point value reflecting its importance to autonomous trust decisions.
          </p>

          <div className="flex items-center gap-1 rounded-lg overflow-hidden h-8 mb-2">
            {METHODOLOGY.categories.map((cat) => (
              <div
                key={cat.name}
                className={`${cat.color} h-full flex items-center justify-center text-xs font-bold text-white`}
                style={{ width: `${cat.maxPoints}%` }}
                title={`${cat.name}: ${cat.maxPoints} pts`}
              >
                {cat.maxPoints}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
            {METHODOLOGY.categories.map((cat) => (
              <span key={cat.name} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                {cat.name} ({cat.maxPoints})
              </span>
            ))}
          </div>
        </section>

        {/* Detailed categories */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Scoring Categories</h2>

          {METHODOLOGY.categories.map((cat) => {
            const IconComponent = CATEGORY_ICONS[cat.icon];
            return (
              <Card key={cat.name} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-base">
                      {IconComponent && <IconComponent className="w-5 h-5 text-primary" />}
                      {cat.name}
                    </span>
                    <Badge className={`${cat.color} text-white border-0`}>
                      {cat.maxPoints} pts max
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cat.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border bg-muted/20 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-3 py-2 font-medium">Signal</th>
                          <th className="text-left px-3 py-2 font-medium">Condition</th>
                          <th className="text-right px-3 py-2 font-medium">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.signals.map((signal, i) => (
                          <tr key={i} className={i < cat.signals.length - 1 ? "border-b border-border/50" : ""}>
                            <td className="px-3 py-2 font-medium text-foreground">{signal.name}</td>
                            <td className="px-3 py-2 text-muted-foreground">{signal.condition}</td>
                            <td className="px-3 py-2 text-right font-mono text-foreground">{signal.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Verdicts */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Trust Verdicts</h2>
          <p className="text-muted-foreground leading-relaxed">
            Every agent receives a trust verdict derived from the composite score, quality classification, and spam analysis. Verdicts are designed to be machine-readable — agents querying the Trust API receive a single verdict string alongside the full score breakdown.
          </p>

          <div className="grid gap-3">
            {VERDICT_CONFIG.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.verdict} className={`rounded-lg border p-4 ${v.bg}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 ${v.color} shrink-0`} />
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${v.color}`}>{v.verdict}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {v.criteria.map((c, i) => (
                          <Badge key={i} variant="outline" className="text-xs font-normal">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Quality Classification */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Quality Classification</h2>
          <p className="text-muted-foreground leading-relaxed">
            Before scoring, every agent is classified into a quality tier. Classification uses heuristics on metadata completeness, naming patterns, and known spam indicators. The tier feeds into the verdict logic — agents classified as spam or archived cannot receive a TRUSTED verdict regardless of score.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { tier: "High", desc: "Complete metadata, real project identity, active endpoints" },
              { tier: "Medium", desc: "Partial metadata, recognizable identity, some signals present" },
              { tier: "Low", desc: "Minimal metadata, few trust signals, possibly inactive" },
              { tier: "Spam", desc: "Known spam patterns, placeholder names, no real functionality" },
            ].map((t) => (
              <Card key={t.tier}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">{t.tier}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Data Sources & Freshness */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data Sources & Update Frequency</h2>
          <p className="text-muted-foreground leading-relaxed">
            Trust scores are computed from on-chain and off-chain data. Each data source has its own indexing cadence to balance freshness with infrastructure cost.
          </p>
          <div className="rounded-lg border bg-muted/20 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Cadence</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { source: "ERC-8004 Indexer", data: "Identity registration, metadata updates, reputation events", cadence: "Every 2 hours (9 chains)" },
                  { source: "x402 Prober", data: "Payment endpoint discovery, pricing, availability", cadence: "Daily" },
                  { source: "Transaction Indexer", data: "On-chain payment volume to agent addresses", cadence: "Daily" },
                  { source: "Community Scraper", data: "GitHub health, Farcaster engagement, on-chain feedback", cadence: "Daily (4 AM UTC)" },
                  { source: "Score Recalculation", data: "Composite trust scores, verdicts, quality classification", cadence: "Daily (5 AM UTC)" },
                  { source: "Report Compilation", data: "Cached trust reports for API consumers", cadence: "1-hour TTL, recompiled on access or daily batch" },
                ].map((row, i, arr) => (
                  <tr key={i} className={i < arr.length - 1 ? "border-b border-border/50" : ""}>
                    <td className="px-3 py-2 font-medium text-foreground">{row.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.data}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.cadence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Transparency principles */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Methodology Principles</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {METHODOLOGY.principles.map((p) => (
              <Card key={p.title}>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-1">{p.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-lg border bg-muted/30 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Query the Oracle</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Trust verdicts and full score breakdowns are available programmatically via the Trust API. Quick checks start at $0.01 per query via x402 micropayment.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/trust-api">
              <Button className="gap-2">
                Trust API
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/agents">
              <Button variant="outline" className="gap-2">
                Explore Agents
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
