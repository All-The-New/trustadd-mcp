import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Clock,
  Users,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  TrendingUp,
  CircleDot,
  HelpCircle,
  AlertTriangle,
  Coins,
  Award,
  Info,
  Link as LinkIcon,
  Zap,
  Github,
  Globe,
  Lock,
  Code,
  Star,
  RefreshCw,
  Flag,
  Activity,
  Database,
  Search,
  BarChart3,
  FileText,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { METHODOLOGY, SEO as SEO_CONTENT } from "@/lib/content-zones";

/* ────────────────────────────────────────────────────────────
   DATA
   ──────────────────────────────────────────────────────────── */

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Clock,
  Users,
  Coins,
  Award,
};

// Ordered low → high to read left-to-right alongside the gradient bar (red → green).
const V2_TIERS = [
  {
    name: "Flagged",
    range: "0–4",
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/30",
    description: "Active negative signals: spam patterns, failed transactions, confirmed bad behavior.",
  },
  {
    name: "Unverified",
    range: "5–19",
    icon: HelpCircle,
    color: "text-zinc-500",
    bg: "bg-zinc-600/10 border-zinc-600/30",
    description: "Minimal profile, no behavioral evidence.",
  },
  {
    name: "Insufficient Data",
    range: "20–39",
    icon: CircleDot,
    color: "text-zinc-400",
    bg: "bg-zinc-500/10 border-zinc-500/30",
    description: "Profile present, no verified behavioral evidence yet.",
  },
  {
    name: "Building",
    range: "40–59",
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/30",
    description: "Early behavioral evidence — track record forming.",
  },
  {
    name: "Trusted",
    range: "60–79",
    icon: CheckCircle,
    color: "text-green-400",
    bg: "bg-green-500/10 border-green-500/30",
    description: "Meaningful transaction history and positive attestation signals.",
  },
  {
    name: "Verified",
    range: "80–100",
    icon: ShieldCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    description: "Extensive verified behavioral evidence from multiple sources confirms trust.",
  },
];

const VERIFICATIONS = [
  { name: "Multi-Chain", icon: LinkIcon, desc: "Registered on 3+ chains", color: "text-violet-400" },
  { name: "x402 Enabled", icon: Zap, desc: "x402 endpoint detected and responsive", color: "text-emerald-400" },
  { name: "GitHub Connected", icon: Github, desc: "Linked GitHub project with health data", color: "text-zinc-300" },
  { name: "Farcaster Connected", icon: Globe, desc: "Farcaster social presence detected", color: "text-purple-400" },
  { name: "IPFS Metadata", icon: Lock, desc: "Metadata on IPFS or Arweave", color: "text-cyan-400" },
  { name: "OASF Skills", icon: Code, desc: "Declared OASF skills/capabilities", color: "text-blue-400" },
  { name: "Early Adopter", icon: Star, desc: "Registered before June 2026", color: "text-amber-400" },
  { name: "Active Maintainer", icon: RefreshCw, desc: "Regular updates over 90+ days", color: "text-green-400" },
  { name: "First Transaction", icon: Flag, desc: "At least one verified payment received", color: "text-emerald-300" },
];

const DATA_SOURCES = [
  { source: "ERC-8004 Indexer", data: "Identity, metadata events, reputation attestations", icon: Database },
  { source: "x402 Prober", data: "Payment endpoint discovery, pricing, liveness", icon: Search },
  { source: "Transaction Indexer", data: "Inbound payment volume to agent addresses", icon: Activity },
  { source: "Community Scraper", data: "GitHub health, Farcaster engagement", icon: Users },
  { source: "Score Engine", data: "Composite scores, tiers, verdicts", icon: BarChart3 },
  { source: "Report Compiler", data: "Cached trust reports for API consumers", icon: FileText },
];

/* ────────────────────────────────────────────────────────────
   INFOGRAPHIC COMPONENTS
   ──────────────────────────────────────────────────────────── */

function ScoreCompositionRing() {
  const size = 240;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const gap = 3;

  const segments = [
    { label: "Transactions", pts: 35, color: "#10b981" },
    { label: "Reputation", pts: 25, color: "#06b6d4" },
    { label: "Profile", pts: 15, color: "#818cf8" },
    { label: "Longevity", pts: 15, color: "#8b5cf6" },
    { label: "Community", pts: 10, color: "#f59e0b" },
  ];

  let accumulated = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-[0_0_30px_rgba(16,185,129,0.15)]"
      >
        {segments.map((seg) => {
          const segmentLength = (seg.pts / 100) * circumference - gap;
          const gapLength = circumference - segmentLength;
          const currentOffset = -(accumulated + gap / 2);
          accumulated += (seg.pts / 100) * circumference;

          return (
            <circle
              key={seg.label}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${segmentLength} ${gapLength}`}
              strokeDashoffset={currentOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
              style={{ opacity: 0.9 }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tracking-tight text-foreground">60<span className="text-muted-foreground">/</span>40</span>
        <span className="text-xs text-muted-foreground mt-0.5">Behavioral / Supporting</span>
      </div>
    </div>
  );
}

function TierGradientBar() {
  return (
    <div className="w-full">
      {/* Continuous gradient bar */}
      <div className="relative h-3 rounded-full overflow-hidden mb-6">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, #ef4444 0%, #ef4444 4%, #71717a 4%, #71717a 19%, #a1a1aa 19%, #a1a1aa 39%, #3b82f6 39%, #3b82f6 59%, #22c55e 59%, #22c55e 79%, #10b981 79%, #10b981 100%)",
          }}
        />
        {/* Segment dividers */}
        {[4, 19, 39, 59, 79].map((pos) => (
          <div
            key={pos}
            className="absolute top-0 bottom-0 w-0.5 bg-background/80"
            style={{ left: `${pos}%` }}
          />
        ))}
      </div>

      {/* Tier cards below */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {V2_TIERS.map((tier) => {
          const Icon = tier.icon;
          return (
            <div
              key={tier.name}
              className={`rounded-lg border p-3 ${tier.bg} transition-colors`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-4 h-4 ${tier.color}`} />
                <span className={`text-sm font-semibold ${tier.color}`}>{tier.name}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-1.5">{tier.range}</div>
              <p className="text-[11px] leading-tight text-muted-foreground/80">{tier.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SignalFlowDiagram() {
  const steps = [
    { label: "Data Sources", sub: "9 chains, 6 indexers", icon: Database },
    { label: "20+ Signals", sub: "Behavioral & profile", icon: Activity },
    { label: "5 Categories", sub: "Weighted 35/25/15/15/10", icon: BarChart3 },
    { label: "Score 0–100", sub: "Risk assessment", icon: Shield },
    { label: "6 Tiers", sub: "Verified → Flagged", icon: ShieldCheck },
  ];

  return (
    <div className="flex items-center justify-between gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={step.label} className="flex items-center gap-1 shrink-0">
            <div className="flex flex-col items-center text-center min-w-[90px]">
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-1.5">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-foreground leading-tight">{step.label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{step.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground/40 shrink-0 mx-1" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EvidenceBasisComparison() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Thin data example */}
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-zinc-700/50 flex items-center justify-center">
            <CircleDot className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-300">Score: 28</div>
            <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-600">Insufficient Data</Badge>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="text-zinc-500">Transactions: None recorded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span className="text-zinc-500">Attestations: None recorded</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-zinc-400">Profile: Complete</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-zinc-400">Community: GitHub connected</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-700/50">
          <p className="text-[11px] text-zinc-500 italic">Based on profile data only — no verified transactions recorded yet</p>
        </div>
      </div>

      {/* Rich data example */}
      <div className="rounded-lg border border-emerald-700/30 bg-emerald-950/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold text-emerald-300">Score: 84</div>
            <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-700">Verified</Badge>
          </div>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-zinc-300">Transactions: 47 from 12 unique payers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            <span className="text-zinc-300">Attestations: 8 from 6 unique attestors</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-zinc-300">Profile: Complete with IPFS metadata</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-zinc-300">Community: GitHub + Farcaster</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-emerald-700/30">
          <p className="text-[11px] text-emerald-500/80 italic">Based on 47 verified transactions from 12 unique payers and 8 attestations</p>
        </div>
      </div>
    </div>
  );
}

function CategoryWeightBar({ name, points, color, type }: { name: string; points: number; color: string; type: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 sm:w-32 text-right">
        <span className="text-sm font-medium text-foreground">{name}</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-6 rounded-full bg-muted/30 overflow-hidden relative">
          <div
            className={`h-full rounded-full ${color} transition-all duration-700 flex items-center justify-end pr-2`}
            style={{ width: `${points}%` }}
          >
            <span className="text-[11px] font-bold text-white drop-shadow-sm">{points}</span>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] shrink-0 ${type === "behavioral" ? "border-emerald-600/50 text-emerald-400" : "border-zinc-600/50 text-zinc-400"}`}>
          {type === "behavioral" ? "Core" : "Supporting"}
        </Badge>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   TWO-LAYER VISUAL
   ──────────────────────────────────────────────────────────── */

function TwoLayerArchitecture() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-950/10 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">Layer 1</Badge>
            <span className="text-lg font-bold text-emerald-300">Trust Rating</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            The headline score (0–100). Driven by blockchain-verifiable behavioral evidence. Powers machine-readable verdicts and human-visible tier badges.
          </p>
          <div className="text-xs text-emerald-400/60 font-mono">
            Score → Tier → Verdict → Machine Decision
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-indigo-500/30 bg-indigo-950/10 p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20">Layer 2</Badge>
            <span className="text-lg font-bold text-indigo-300">Verifications</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            Observable facts about an agent — confirmed presence on a chain, a working endpoint, a linked GitHub project. Each fact is shown as a Verification Badge on profiles and in listings. They don't affect the Trust Rating.
          </p>
          <div className="text-xs text-indigo-400/60 font-mono">
            Signal → Verified Fact → Verification Badge
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────────────── */

export default function Methodology() {
  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.methodology.title}
        description={SEO_CONTENT.methodology.description}
        path="/methodology"
      />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-14">

        {/* ── HERO ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="text-xs font-mono">v2</Badge>
            <span className="text-xs text-muted-foreground">Methodology Version 2 — Behavioral-First Scoring</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            {METHODOLOGY.header.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg leading-relaxed max-w-2xl">
            {METHODOLOGY.header.subtitle}
          </p>
        </div>

        {/* ── ECOSYSTEM NOTICE ── */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-300 mb-1">Early Ecosystem Notice</div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {METHODOLOGY.ecosystemNotice}
            </p>
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{METHODOLOGY.overview.title}</h2>
          <div className="text-muted-foreground space-y-3 leading-relaxed">
            {METHODOLOGY.overview.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── SIGNAL FLOW DIAGRAM ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">How It Works</h2>
          <Card className="overflow-hidden">
            <CardContent className="pt-5 pb-4">
              <SignalFlowDiagram />
            </CardContent>
          </Card>
        </section>

        {/* ── TWO-LAYER ARCHITECTURE ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Two-Layer Architecture</h2>
          <p className="text-muted-foreground leading-relaxed">
            TrustAdd separates what an agent has <strong className="text-foreground">done</strong> from how it has <strong className="text-foreground">set up</strong>. The Trust Rating measures behavioral track record. Verifications surface observable facts as visible badges on the profile. Both are useful — only one drives trust decisions.
          </p>
          <TwoLayerArchitecture />
        </section>

        {/* ── SCORE COMPOSITION ── */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold">Score Composition</h2>
          <p className="text-muted-foreground leading-relaxed">
            The TrustAdd Score ranges from 0 to 100, composed of five categories. <strong className="text-emerald-400">60 points</strong> come from blockchain-verifiable behavioral signals. <strong className="text-zinc-300">40 points</strong> come from profile, longevity, and community signals.
          </p>

          <div className="flex flex-col lg:flex-row items-center gap-8">
            {/* Ring chart */}
            <div className="shrink-0">
              <ScoreCompositionRing />
            </div>

            {/* Legend + weight bars */}
            <div className="flex-1 w-full space-y-3">
              {METHODOLOGY.categories.map((cat) => (
                <CategoryWeightBar
                  key={cat.name}
                  name={cat.shortName}
                  points={cat.maxPoints}
                  color={cat.color}
                  type={cat.type}
                />
              ))}
            </div>
          </div>

          {/* Stacked bar */}
          <div className="space-y-2">
            <div className="flex items-center gap-0.5 rounded-lg overflow-hidden h-8">
              {METHODOLOGY.categories.map((cat) => (
                <div
                  key={cat.name}
                  className={`${cat.color} h-full flex items-center justify-center text-xs font-bold text-white transition-all`}
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
          </div>
        </section>

        {/* ── TRUST TIERS ── */}
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Trust Tiers</h2>
          <p className="text-muted-foreground leading-relaxed">
            Every agent receives one of six trust tiers. Tiers are designed to be machine-readable — agents querying the Trust API receive a tier string alongside the numeric score. <strong className="text-foreground">Flagged</strong> requires active negative evidence, not merely a low score.
          </p>
          <TierGradientBar />
        </section>

        {/* ── SCORING CATEGORIES DETAIL ── */}
        <section className="space-y-5">
          <h2 className="text-xl font-semibold">Scoring Categories</h2>

          {/* Calibration note */}
          <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/30 p-4 flex gap-3">
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-zinc-300">Weights are calibrating.</strong> Each category below describes <em>what</em> we measure and the directional relationship (e.g., "more transactions score higher"). Exact thresholds and point values are intentionally omitted while v2 weights calibrate against early ecosystem data. Precise weights will be published in a future methodology version once we have sufficient transaction and attestation volume to validate them.
            </p>
          </div>

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
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${cat.type === "behavioral" ? "border-emerald-600/50 text-emerald-400" : "border-zinc-600/50 text-zinc-400"}`}>
                        {cat.type === "behavioral" ? "Behavioral Core" : "Supporting"}
                      </Badge>
                      <Badge className={`${cat.color} text-white border-0`}>
                        {cat.maxPoints} pts
                      </Badge>
                    </div>
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
                          <th className="text-left px-3 py-2 font-medium w-1/3">Signal</th>
                          <th className="text-left px-3 py-2 font-medium">What It Measures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.signals.map((signal, i) => (
                          <tr key={i} className={i < cat.signals.length - 1 ? "border-b border-border/50" : ""}>
                            <td className="px-3 py-2 font-medium text-foreground align-top">{signal.name}</td>
                            <td className="px-3 py-2 text-muted-foreground leading-relaxed">{signal.description}</td>
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

        {/* ── EVIDENCE BASIS ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Evidence Basis</h2>
          <p className="text-muted-foreground leading-relaxed">
            A score of 35 means very different things depending on what evidence produced it. Every Trust Rating includes an evidence summary — the "how many reviews" signal that tells you how seriously to take the number.
          </p>
          <EvidenceBasisComparison />
        </section>

        {/* ── VERIFICATIONS ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Verifications</h2>
          <p className="text-muted-foreground leading-relaxed">
            Verifications are observable facts about an agent — a working endpoint, presence on a chain, a linked GitHub project. Each verified fact appears as a <strong className="text-foreground">Verification Badge</strong> on agent profiles and in directory listings. Verification Badges do <strong className="text-foreground">not</strong> affect the Trust Rating, but they recognize meaningful setup work and give new agents earnable milestones while behavioral history accumulates.
          </p>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {VERIFICATIONS.map((verification) => {
              const Icon = verification.icon;
              return (
                <div key={verification.name} className="rounded-lg border bg-muted/10 p-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                  <div className={`w-8 h-8 rounded-lg bg-background border flex items-center justify-center shrink-0 ${verification.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{verification.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-tight">{verification.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── DATA SOURCES ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Data Sources</h2>
          <p className="text-muted-foreground leading-relaxed">
            Trust scores are computed from on-chain and off-chain data, sourced from the systems below. Indexing cadence varies and may change as we tune the pipeline. All data is independently verifiable.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {DATA_SOURCES.map((src) => {
              const Icon = src.icon;
              return (
                <div key={src.source} className="rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{src.source}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{src.data}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── PRINCIPLES ── */}
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

        {/* ── VERSIONING ── */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Versioning & Evolution</h2>
          <p className="text-muted-foreground leading-relaxed">
            Methodology changes are versioned, announced, and trigger full score recalculation. All scores include the methodology version that produced them.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Card className="border-primary/30">
              <CardContent className="pt-4">
                <Badge className="mb-2 bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">Current</Badge>
                <h3 className="text-sm font-semibold mb-1">v2 — Behavioral First</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">60/40 behavioral/supporting split. Six trust tiers. Verifications separated from Trust Rating.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Badge variant="outline" className="mb-2 text-[10px]">Planned</Badge>
                <h3 className="text-sm font-semibold mb-1">v3 — Deep Behavioral</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">70/30 weight shift. Counterparty-quality attestation weighting (EigenTrust). Transaction pattern analysis.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <Badge variant="outline" className="mb-2 text-[10px]">Future</Badge>
                <h3 className="text-sm font-semibold mb-1">v4+ — Adaptive</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Sybil cluster detection. Empirically-calibrated weights from outcome data. Multi-chain expansion.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="rounded-lg border bg-muted/30 p-6 space-y-3">
          <h2 className="text-lg font-semibold">Query the Oracle</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Trust verdicts, score breakdowns, and evidence basis are available programmatically via the Trust API. Quick checks start at $0.01 per query via x402 micropayment.
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
