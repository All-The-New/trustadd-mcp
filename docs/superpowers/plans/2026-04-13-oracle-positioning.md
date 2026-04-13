# Oracle Positioning & Content Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reposition TrustAdd from "trust ratings platform" to "The Trust Oracle for the Agent Economy" — rewrite all website copy, restructure navigation to 4-item layout (Agents | Analytics dropdown | Trust API | About dropdown), create new Trust API page, and ensure cohesive product story across free ecosystem analytics and paid trust intelligence.

**Architecture:** All user-facing copy lives in `client/src/lib/content-zones.ts`. Navigation is in `client/src/components/header.tsx`, footer in `footer.tsx`. SEO meta in `seo.tsx` + `client/index.html` + `api/agent/[id].ts`. New Trust API page at `/trust-api` route. Dropdown navigation uses existing shadcn `DropdownMenu` components.

**Tech Stack:** React, wouter routing, shadcn/ui, Tailwind CSS, TanStack Query, TypeScript, content-zones.ts centralized copy system.

---

## File Structure

### Files to Create
- `client/src/pages/trust-api.tsx` — New Trust API product page (pricing, live demo, integration guide)

### Files to Modify
- `client/src/lib/content-zones.ts` — All copy updates (hero, about, nav, SEO, all page descriptions)
- `client/src/components/header.tsx` — New 4-item nav with dropdown menus
- `client/src/components/footer.tsx` — Updated tagline and links
- `client/src/App.tsx` — Add `/trust-api` route
- `client/index.html` — Update static meta tags for new positioning
- `api/agent/[id].ts` — Update SSR meta descriptions
- `client/src/pages/landing.tsx` — Restructure hero, add Trust Oracle section, update layout
- `client/src/pages/about.tsx` — Rewrite mission, principles, methodology framing
- `client/src/pages/api-docs.tsx` — Update intro copy, add Trust Intelligence section at top
- `client/src/pages/economy.tsx` — Update SEO + subtitle for Oracle framing
- `client/src/pages/analytics.tsx` — Update SEO + subtitle
- `client/src/pages/skills.tsx` — Update SEO + subtitle
- `client/src/pages/quality.tsx` — Update SEO + subtitle
- `client/src/pages/bazaar.tsx` — Update SEO + subtitle
- `client/src/pages/status.tsx` — Minor SEO update
- `client/src/pages/protocols.tsx` — Update intro framing
- `client/src/pages/directory.tsx` — Update SEO description
- `client/src/components/seo.tsx` — Update SITE_NAME subtitle pattern

---

### Task 1: Update content-zones.ts — Core Copy Rewrite

All copy lives in this single file. This is the foundation — everything else references it.

**Files:**
- Modify: `client/src/lib/content-zones.ts`

- [ ] **Step 1: Rewrite HOME section**

Replace the entire `HOME` export with the new Oracle positioning:

```ts
export const HOME = {
  hero: {
    tag: "The Trust Oracle for the Agent Economy",
    title: "The Trust Oracle for the",
    titleAccent: "Agent Economy",
    subtitle:
      "Before your agent transacts, it checks TrustAdd. We index identity, payments, and reputation across 9 chains into a single trust verdict — queryable by any agent via x402 micropayment.",
    ctaPrimary: "Explore Agents",
    ctaSecondary: "Trust API",
  },
  features: [
    {
      icon: "Shield" as const,
      title: "Trust Intelligence On Demand",
      desc: "Agents query TrustAdd before transacting — like a credit check for the agent economy. Quick verdicts from $0.01 USDC, full evidence reports from $0.05.",
    },
    {
      icon: "Layers" as const,
      title: "Cross-Layer Intelligence",
      desc: "The only oracle combining ERC-8004 identity, x402 payment data, marketplace analytics, and community signals into one composite trust score.",
    },
    {
      icon: "Bot" as const,
      title: "Built for Agents, Readable by Humans",
      desc: "Machine-queryable Trust API via x402 and MCP. Free ecosystem analytics for developers and researchers exploring the agent economy.",
    },
  ],
  pillars: {
    heading: "Five Dimensions of Agent Trust",
    subtitle:
      "Every trust verdict is computed from five signal categories, weighted to reflect what matters most for autonomous decision-making.",
    items: [
      {
        icon: "Shield" as const,
        title: "Identity & Capability",
        desc: "On-chain identity completeness, declared skills, endpoints, x402 payment support. Agents with verifiable identity and clear capabilities score higher.",
        badge: "Identity + Capability",
        badgeVariant: "live" as const,
      },
      {
        icon: "Star" as const,
        title: "Community & Reputation",
        desc: "GitHub health, Farcaster engagement, on-chain feedback. Real-world signals from people and systems that interact with agents.",
        badge: "Community",
        badgeVariant: "monitoring" as const,
      },
      {
        icon: "Eye" as const,
        title: "History & Transparency",
        desc: "Registration longevity, multi-chain presence, decentralized storage, trust mechanism declarations. Transparency signals accountability.",
        badge: "History + Transparency",
        badgeVariant: "live" as const,
      },
    ],
  },
  api: {
    title: "Trust Oracle API",
    desc: "Agents query TrustAdd before transacting. Ecosystem analytics are free and open. Trust intelligence starts at $0.01 per query via x402 micropayment on Base.",
    cta: "View Trust API",
  },
  topTrusted: {
    heading: "Top Trusted Agents",
    viewAll: "View leaderboard",
    emptyState: "Trust scores are being calculated. Check back soon.",
  },
  recentlyDiscovered: {
    heading: "Recently Discovered",
    viewAll: "View all agents",
  },
  liveIndexing: {
    heading: "Live Indexing",
  },
  emptyState:
    "The oracle is scanning blockchains for AI agent identities. Agents will appear here automatically as they are discovered.",
};
```

- [ ] **Step 2: Rewrite STATS section**

```ts
export const STATS = {
  agentsLabel: "Agents Indexed",
  metadataLabel: "Oracle Verified",
  x402Label: "x402 Active",
  blockLabel: "Last Block",
};
```

- [ ] **Step 3: Rewrite ABOUT section**

```ts
export const ABOUT = {
  header: {
    title: "About TrustAdd",
    subtitle:
      "The trust oracle for the agent economy. We believe trust should be measurable, transparent, and queryable by any agent.",
  },
  mission: {
    title: "Our Mission",
    paragraphs: [
      "As AI agents transact autonomously, knowing which ones to trust is critical infrastructure. TrustAdd is the trust oracle — agents query us before transacting, the way financial systems query credit bureaus before lending.",
      "We index identity, payments, and reputation signals from ERC-8004, x402, and emerging standards across 9 EVM chains. We combine them into a single, transparent trust verdict — available to any agent via x402 micropayment, and to any human through our free analytics dashboard.",
    ],
  },
  score: {
    title: "How the TrustAdd Score Works",
    intro:
      "Every indexed agent receives a TrustAdd Score from 0 to 100, computed from five categories of on-chain and off-chain signals. The score powers trust verdicts: TRUSTED, CAUTION, UNTRUSTED, or UNKNOWN.",
  },
  principles: {
    title: "Principles",
    items: [
      {
        title: "Neutral & Verifiable",
        desc: "We present data as-is. No endorsements, no manipulation. The scoring formula is applied equally to every agent, and the methodology is published openly.",
      },
      {
        title: "Open Ecosystem, Paid Intelligence",
        desc: "Ecosystem analytics are free — no auth required. Per-agent trust intelligence is available via x402 micropayment, from $0.01 per query. We charge for intelligence, not access.",
      },
      {
        title: "Discovery-First",
        desc: "We find agents automatically by scanning blockchains and indexing protocol events. No manual submissions, no gatekeeping. If it's on-chain, TrustAdd finds it.",
      },
    ],
  },
  protocols: {
    title: "Supported Protocols",
    intro:
      "TrustAdd indexes agent data from multiple protocols. Each feeds different trust signals into the oracle.",
  },
};
```

- [ ] **Step 4: Rewrite PROTOCOLS intro**

```ts
export const PROTOCOLS = {
  pageTitle: "Protocols",
  pageSubtitle:
    "TrustAdd indexes agent identity, payments, and capability data from multiple protocols — feeding trust signals into the oracle.",
  // ... items array stays the same (protocol details haven't changed)
```

Only change `pageTitle` and `pageSubtitle`. Leave the `items` array untouched.

- [ ] **Step 5: Rewrite API_DOCS section**

```ts
export const API_DOCS = {
  seo: {
    title: "API Documentation",
    description:
      "REST API for the agent economy. Free ecosystem analytics, plus x402-gated trust intelligence from $0.01 per query.",
  },
  intro:
    "TrustAdd provides two API tiers. Ecosystem analytics are free and open — no authentication required. Per-agent trust intelligence (scores, verdicts, breakdowns, evidence) is available via x402 micropayment.",
  usageNotes: {
    dataSource:
      "Data is sourced from 9 EVM chains via ERC-8004, x402, OASF, and community signals. Data freshness depends on indexer status. Use the chainId parameter to filter by chain.",
  },
};
```

- [ ] **Step 6: Rewrite ANALYTICS, ECONOMY, SKILLS, STATUS, DIRECTORY SEO**

```ts
export const ANALYTICS = {
  seo: {
    title: "Ecosystem Analytics",
    description:
      "Free, live analytics across the AI agent economy — trust score distributions, chain metrics, protocol adoption, and ecosystem growth trends.",
  },
  subtitle: "Free, live insights across the AI agent economy",
};

export const ECONOMY = {
  seo: {
    title: "Agent Economy",
    description:
      "Explore the x402 agent payment ecosystem. Transaction volumes, payment adoption, top-earning agents, and economic trends across 9 EVM chains.",
  },
};

export const SKILLS = {
  seo: {
    title: "Agent Skills & Capabilities",
    description:
      "What AI agents can do. Browse capabilities, skill categories, trust correlations, and the most capable agents in the ecosystem.",
  },
  subtitle: "What agents can do across protocols and chains",
};

export const STATUS = {
  seo: {
    title: "Oracle Status",
    description:
      "Live monitoring of TrustAdd's multi-chain oracle. Indexer health, per-chain progress, and system alerts.",
  },
};

export const DIRECTORY = {
  seo: {
    title: "Agent Directory",
    description:
      "Browse all AI agent identities discovered by the TrustAdd oracle across 9 EVM chains. Filter by chain, protocol support, and trust verdict.",
  },
  emptyState:
    "The oracle is scanning for AI agent identities. Agents will appear here as they are discovered.",
  subtitle: (total: number, chainCount: number) =>
    total > 0
      ? \`\${total.toLocaleString()} agents indexed across \${chainCount} chains\`
      : "Discovering AI agent identities across supported chains",
};
```

- [ ] **Step 7: Rewrite PROFILE, NAV, and SEO sections**

```ts
export const PROFILE = {
  defaultDescription: (chainName: string) =>
    \`This agent was discovered by the TrustAdd oracle on \${chainName}. No additional description has been provided.\`,
  defaultSeoDescription: (erc8004Id: string | number, chainName: string) =>
    \`AI agent #\${erc8004Id} on \${chainName}. Trust verdict, score breakdown, and on-chain history from TrustAdd.\`,
  reputationEmpty:
    "This agent hasn't received on-chain reputation feedback yet. As the protocol ecosystem matures, endorsements from other agents and users will appear here.",
  statusDiscovery: "Discovered automatically via on-chain indexing",
};

export const NAV = {
  footer: {
    tagline:
      "The trust oracle for the agent economy.",
  },
};

export const SEO = {
  landing: {
    title: "The Trust Oracle for the Agent Economy",
    description:
      "TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402.",
  },
  about: {
    title: "About",
    description:
      "Learn about TrustAdd's mission as the trust oracle for the agent economy, the TrustAdd Score methodology, and our open, verifiable approach to agent trust.",
  },
  protocols: {
    title: "Protocols",
    description:
      "Protocols powering the TrustAdd oracle — ERC-8004 identity, x402 payments, OASF skills, MCP tools, A2A communication.",
  },
  trustApi: {
    title: "Trust API",
    description:
      "Query the TrustAdd oracle. Quick trust checks from $0.01 USDC, full evidence reports from $0.05. Paid via x402 micropayment on Base. Free ecosystem analytics included.",
  },
};
```

- [ ] **Step 8: Verify content-zones.ts compiles**

Run: `cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit client/src/lib/content-zones.ts 2>&1 | head -20`

Expected: No errors (or only errors from external imports which is fine for a content file).

- [ ] **Step 9: Commit content-zones rewrite**

```bash
git add client/src/lib/content-zones.ts
git commit -m "content: rewrite all copy for Trust Oracle positioning

- Hero: 'Trust Oracle for the Agent Economy'
- Features: Trust Intelligence, Cross-Layer, Built for Agents
- About: mission framed around oracle/credit-check metaphor
- Principles: 'Open Ecosystem, Paid Intelligence'
- All SEO descriptions updated
- Nav tagline: 'The trust oracle for the agent economy'
- Consistent terminology: oracle, trust intelligence, ecosystem analytics"
```

---

### Task 2: Restructure Navigation — 4-Item Layout

**Files:**
- Modify: `client/src/components/header.tsx`

- [ ] **Step 1: Replace entire header.tsx with new nav structure**

```tsx
import { Link, useLocation } from "wouter";
import { Shield, Bot, BarChart3, ChevronDown, Zap, Info, BookOpen, Layers, Activity, ShieldCheck, Sparkles, Store, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

const analyticsRoutes = ["/analytics", "/economy", "/skills", "/bazaar", "/quality", "/status"];
const aboutRoutes = ["/about", "/protocols", "/api-docs"];

export function Header() {
  const [location] = useLocation();

  const analyticsActive = analyticsRoutes.includes(location);
  const aboutActive = aboutRoutes.includes(location);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-2 cursor-pointer">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tighter">TrustAdd</span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/agents">
            <Button
              variant={location === "/agents" || location.startsWith("/agent/") ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-directory"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Agents</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={analyticsActive ? "secondary" : "ghost"}
                className="gap-2"
                data-testid="dropdown-analytics"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Analytics</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <Link href="/analytics">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <BarChart3 className="w-4 h-4" />
                  Overview
                </DropdownMenuItem>
              </Link>
              <Link href="/economy">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Coins className="w-4 h-4" />
                  Economy
                </DropdownMenuItem>
              </Link>
              <Link href="/skills">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Sparkles className="w-4 h-4" />
                  Skills
                </DropdownMenuItem>
              </Link>
              <Link href="/bazaar">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Store className="w-4 h-4" />
                  Bazaar
                </DropdownMenuItem>
              </Link>
              <Link href="/quality">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <ShieldCheck className="w-4 h-4" />
                  Quality
                </DropdownMenuItem>
              </Link>
              <Link href="/status">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Activity className="w-4 h-4" />
                  Oracle Status
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/trust-api">
            <Button
              variant={location === "/trust-api" ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-trust-api"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Trust API</span>
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={aboutActive ? "secondary" : "ghost"}
                className="gap-2"
                data-testid="dropdown-about"
              >
                <span className="hidden sm:inline">About</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <Link href="/about">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Info className="w-4 h-4" />
                  About TrustAdd
                </DropdownMenuItem>
              </Link>
              <Link href="/protocols">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Layers className="w-4 h-4" />
                  Protocols
                </DropdownMenuItem>
              </Link>
              <Link href="/api-docs">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <BookOpen className="w-4 h-4" />
                  API Documentation
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify header renders correctly**

Run: `cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit 2>&1 | grep -i header | head -10`

Expected: No type errors related to header.tsx.

- [ ] **Step 3: Commit nav restructure**

```bash
git add client/src/components/header.tsx
git commit -m "nav: restructure to 4-item layout

Agents | Analytics (dropdown) | Trust API | About (dropdown)

Analytics dropdown: Overview, Economy, Skills, Bazaar, Quality, Oracle Status
About dropdown: About TrustAdd, Protocols, API Documentation
Trust API: new top-level link to /trust-api (page added in later task)"
```

---

### Task 3: Update Footer

**Files:**
- Modify: `client/src/components/footer.tsx`

- [ ] **Step 1: Replace footer.tsx with updated content**

```tsx
import { Link } from "wouter";
import { Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card/50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary">
              <Shield className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-medium">TrustAdd</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            The trust oracle for the agent economy.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/trust-api" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Trust API
            </Link>
            <Link href="/api-docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Docs
            </Link>
            <span className="text-xs text-muted-foreground">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit footer update**

```bash
git add client/src/components/footer.tsx
git commit -m "footer: update tagline to oracle positioning, add Trust API link"
```

---

### Task 4: Update Static HTML Meta Tags

**Files:**
- Modify: `client/index.html`

- [ ] **Step 1: Replace meta tags in index.html**

Find and replace the `<title>` and meta tags in the `<head>`:

Old:
```html
<title>TrustAdd — Trust Ratings for AI Agents</title>
<meta name="description" content="TrustAdd is a public, neutral trust rating platform for AI agents across protocols and EVM chains. Discover, verify, and compare agents with the TrustAdd Score." />
<meta property="og:title" content="TrustAdd — Trust Ratings for AI Agents" />
<meta property="og:description" content="TrustAdd is a public, neutral trust rating platform for AI agents across protocols and EVM chains. Discover, verify, and compare agents with the TrustAdd Score." />
```

New:
```html
<title>TrustAdd — The Trust Oracle for the Agent Economy</title>
<meta name="description" content="TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402." />
<meta property="og:title" content="TrustAdd — The Trust Oracle for the Agent Economy" />
<meta property="og:description" content="TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402." />
```

Also update the twitter tags:

Old:
```html
<meta name="twitter:title" content="TrustAdd — Trust Ratings for AI Agents" />
<meta name="twitter:description" content="TrustAdd is a public, neutral trust rating platform for AI agents across protocols and EVM chains. Discover, verify, and compare agents with the TrustAdd Score." />
```

New:
```html
<meta name="twitter:title" content="TrustAdd — The Trust Oracle for the Agent Economy" />
<meta name="twitter:description" content="TrustAdd is the trust oracle for AI agents. We index identity, payments, and reputation across 9 EVM chains into queryable trust verdicts — from $0.01 per query via x402." />
```

- [ ] **Step 2: Commit index.html update**

```bash
git add client/index.html
git commit -m "seo: update static meta tags for Trust Oracle positioning"
```

---

### Task 5: Update SSR Meta Tags for Agent Pages

**Files:**
- Modify: `api/agent/[id].ts`

- [ ] **Step 1: Find and update the default description template**

In `api/agent/[id].ts`, find the line that constructs the meta description for agent pages. It currently uses text from `PROFILE.defaultSeoDescription`. Since content-zones.ts was already updated in Task 1, verify the SSR function reads from there or has its own copy.

Read the file first. The SSR function constructs its own meta tags from the agent data. Find the fallback/default description string and update any hardcoded "trust rating" references to "trust oracle" language.

Look for strings like "View trust score" or "trust rating" and replace with "Trust verdict, score breakdown, and on-chain history from TrustAdd."

Also find the site-wide description used in the SSR template's fallback `<meta>` tags and update those to match the new index.html values.

- [ ] **Step 2: Commit SSR meta update**

```bash
git add api/agent/[id].ts
git commit -m "seo: update SSR agent page meta for oracle positioning"
```

---

### Task 6: Create Trust API Page

This is the biggest new piece — a dedicated product page for the paid Trust API.

**Files:**
- Create: `client/src/pages/trust-api.tsx`
- Modify: `client/src/App.tsx` (add route)

- [ ] **Step 1: Add route to App.tsx**

In `client/src/App.tsx`, add the import and route:

After the existing imports, add:
```ts
import TrustApi from "@/pages/trust-api";
```

In the `<Switch>` block, add before the admin routes:
```tsx
<Route path="/trust-api" component={TrustApi} />
```

- [ ] **Step 2: Create trust-api.tsx page**

```tsx
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { SEO as SEO_CONTENT } from "@/lib/content-zones";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Zap,
  FileText,
  DollarSign,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Copy,
  Search,
} from "lucide-react";

function VerdictBadge({ verdict }: { verdict: string }) {
  const variants: Record<string, string> = {
    TRUSTED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    CAUTION: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    UNTRUSTED: "bg-red-500/10 text-red-600 border-red-500/20",
    UNKNOWN: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={variants[verdict] || variants.UNKNOWN}>
      {verdict}
    </Badge>
  );
}

export default function TrustApi() {
  const [demoAddress, setDemoAddress] = useState("");
  const [searchAddress, setSearchAddress] = useState("");

  const { data: demoResult, isLoading: demoLoading, error: demoError } = useQuery({
    queryKey: ["/api/v1/trust", searchAddress, "exists"],
    queryFn: () =>
      fetch(`/api/v1/trust/${searchAddress}/exists`).then((r) => r.json()),
    enabled: !!searchAddress && /^0x[a-fA-F0-9]{40}$/.test(searchAddress),
  });

  const handleDemo = () => {
    if (/^0x[a-fA-F0-9]{40}$/.test(demoAddress)) {
      setSearchAddress(demoAddress);
    }
  };

  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.trustApi.title}
        description={SEO_CONTENT.trustApi.description}
        path="/trust-api"
      />

      <div className="mx-auto max-w-4xl px-4 py-12 space-y-16">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="outline" className="gap-1">
            <Zap className="w-3 h-3" />
            x402 Micropayment
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Trust Oracle API
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Query agent trustworthiness before transacting. Your agent pays per
            query via x402 micropayment on Base — no API keys, no subscriptions.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500" />
                  Quick Check
                </CardTitle>
                <span className="text-2xl font-bold">$0.01</span>
              </div>
              <p className="text-sm text-muted-foreground">per query · USDC on Base</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Fast trust verdict for automated agent decisions. Returns score,
                verdict, tier, and flags in under 200ms (cached).
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  "Trust verdict (TRUSTED / CAUTION / UNTRUSTED / UNKNOWN)",
                  "Composite score (0–100)",
                  "5-category score breakdown",
                  "Quality tier and flags",
                  "x402 status and cross-chain presence",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <code className="block text-xs bg-muted p-3 rounded-md font-mono">
                GET /api/v1/trust/&#123;address&#125;
              </code>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  Full Report
                </CardTitle>
                <span className="text-2xl font-bold">$0.05</span>
              </div>
              <p className="text-sm text-muted-foreground">per report · USDC on Base</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Comprehensive trust evidence for due diligence. Full identity,
                economy, community signals, and on-chain history.
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  "Everything in Quick Check",
                  "Full agent identity and metadata",
                  "Transaction history and volume",
                  "GitHub health and Farcaster engagement",
                  "On-chain registration timeline",
                  "Data freshness timestamps",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <code className="block text-xs bg-muted p-3 rounded-md font-mono">
                GET /api/v1/trust/&#123;address&#125;/report
              </code>
            </CardContent>
          </Card>
        </div>

        {/* Free Discovery */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-background border shrink-0">
                <Search className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">Free Discovery Endpoint</h3>
                <p className="text-sm text-muted-foreground">
                  Check if an agent exists in the oracle before paying for intelligence.
                  Returns name, verdict label, and pricing info — no payment required.
                </p>
                <code className="text-xs bg-background p-2 rounded-md font-mono inline-block mt-2">
                  GET /api/v1/trust/&#123;address&#125;/exists
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Demo */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-center">Try It</h2>
          <p className="text-center text-muted-foreground">
            Enter any EVM address to check if it's in the oracle. This uses the
            free discovery endpoint.
          </p>
          <div className="flex gap-2 max-w-lg mx-auto">
            <Input
              placeholder="0x... (EVM address)"
              value={demoAddress}
              onChange={(e) => setDemoAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDemo()}
              className="font-mono text-sm"
            />
            <Button onClick={handleDemo} disabled={demoLoading}>
              {demoLoading ? "Checking..." : "Check"}
            </Button>
          </div>
          {demoResult && (
            <Card className="max-w-lg mx-auto">
              <CardContent className="pt-6 space-y-3">
                {demoResult.found ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{demoResult.name || "Unnamed Agent"}</span>
                      <VerdictBadge verdict={demoResult.verdict || "UNKNOWN"} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Quick Check: {demoResult.quickCheckPrice || "$0.01"} USDC</p>
                      <p>Full Report: {demoResult.fullReportPrice || "$0.05"} USDC</p>
                      <p>Payment: x402 on {demoResult.paymentNetwork || "Base"}</p>
                    </div>
                    <Link href={`/agent/${searchAddress}`}>
                      <Button variant="outline" size="sm" className="gap-1 mt-2">
                        View Profile <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Address not found in the oracle. This agent hasn't been indexed yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
          {demoError && (
            <p className="text-sm text-destructive text-center">
              Invalid address format. Enter a 0x-prefixed EVM address.
            </p>
          )}
        </div>

        {/* How x402 Works */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">How x402 Payment Works</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Request", desc: "Agent calls the Trust API endpoint" },
              { step: "2", title: "402 Response", desc: "Server returns payment requirements" },
              { step: "3", title: "Pay", desc: "Agent signs USDC authorization on Base" },
              { step: "4", title: "Receive", desc: "Server returns trust intelligence" },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold mx-auto">
                  {s.step}
                </div>
                <h4 className="font-medium text-sm">{s.title}</h4>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Integration Options */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Integration</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">MCP Server</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Query TrustAdd directly from Claude Code, Cursor, or any MCP-compatible agent framework.
                </p>
                <code className="block text-xs bg-muted p-3 rounded-md font-mono">
                  npm install @trustadd/mcp
                </code>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">REST API + x402</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Direct HTTP integration. Your agent handles the x402 payment flow (EIP-3009 USDC authorization on Base).
                </p>
                <Link href="/api-docs">
                  <Button variant="outline" size="sm" className="gap-1 mt-2">
                    API Documentation <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Free Ecosystem Analytics */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Free Ecosystem Analytics</h3>
              <p className="text-muted-foreground">
                Aggregate data about the agent economy is free and open — no auth, no payment.
                Use it to explore the ecosystem, build dashboards, or research trends.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/analytics">
                  <Button variant="outline" size="sm">Analytics</Button>
                </Link>
                <Link href="/economy">
                  <Button variant="outline" size="sm">Economy</Button>
                </Link>
                <Link href="/bazaar">
                  <Button variant="outline" size="sm">Bazaar</Button>
                </Link>
                <Link href="/api-docs">
                  <Button variant="outline" size="sm">API Docs</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
```

- [ ] **Step 3: Verify Trust API page compiles**

Run: `cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit 2>&1 | head -20`

Expected: No type errors.

- [ ] **Step 4: Commit Trust API page**

```bash
git add client/src/pages/trust-api.tsx client/src/App.tsx
git commit -m "feat: add Trust API product page

- Pricing cards for Quick Check ($0.01) and Full Report ($0.05)
- Free discovery endpoint callout
- Live demo: enter address to check oracle (free /exists endpoint)
- x402 payment flow explanation (4-step visual)
- Integration section: MCP server + REST API
- Free ecosystem analytics cross-links
- Route at /trust-api"
```

---

### Task 7: Update Landing Page Layout

The landing page needs to reference the new content-zones copy and link the API CTA to `/trust-api` instead of `/api-docs`.

**Files:**
- Modify: `client/src/pages/landing.tsx`

- [ ] **Step 1: Update CTA links in landing.tsx**

Find the hero CTA secondary button that links to `/api-docs` and change it to link to `/trust-api`:

Old: `<Link href="/api-docs">`  (the one next to "View API" / ctaSecondary)
New: `<Link href="/trust-api">`

Find the API section CTA button that links to `/api-docs` and change it to link to `/trust-api`:

Old: `<Link href="/api-docs">`  (the one in the API section at bottom)
New: `<Link href="/trust-api">`

The text updates happen automatically via content-zones.ts (hero.ctaSecondary is now "Trust API", api.cta is now "View Trust API").

- [ ] **Step 2: Verify landing page renders with updated copy**

Run: `cd /Users/ethserver/CLAUDE/trustadd && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors.

- [ ] **Step 3: Commit landing page updates**

```bash
git add client/src/pages/landing.tsx
git commit -m "landing: update CTAs to link to Trust API page"
```

---

### Task 8: Update About Page Framing

The about page reads from content-zones.ts already, but verify the component references are correct.

**Files:**
- Modify: `client/src/pages/about.tsx` (if any hardcoded copy exists)

- [ ] **Step 1: Read about.tsx and check for hardcoded copy**

Read the full file. Any strings not sourced from `content-zones.ts` need to be updated to oracle language. Common things to check:
- Section headers that might be hardcoded
- Score category descriptions (these are often inline, not from content-zones)
- Principle descriptions
- "Learn More" CTA text

If all copy comes from content-zones.ts, no changes needed here — Task 1 already handled it.

If hardcoded copy exists, update references from "trust rating" → "trust oracle", "trust layer" → "trust oracle", "TrustAdd Score" can stay (it's the product name).

- [ ] **Step 2: Commit about page if changed**

```bash
git add client/src/pages/about.tsx
git commit -m "about: update any hardcoded copy for oracle positioning"
```

---

### Task 9: Update Remaining Page Components

Each analytics/data page uses SEO content from content-zones.ts but may have hardcoded subtitles or descriptions.

**Files:**
- Check/Modify: `client/src/pages/analytics.tsx`, `economy.tsx`, `skills.tsx`, `quality.tsx`, `bazaar.tsx`, `status.tsx`, `protocols.tsx`, `directory.tsx`, `api-docs.tsx`

- [ ] **Step 1: For each page file, read and grep for hardcoded "trust rating" or "trust ratings"**

Run: `cd /Users/ethserver/CLAUDE/trustadd && grep -rn "trust rating" client/src/pages/ --include="*.tsx" -i`

Replace any instances with appropriate oracle language:
- "trust rating" → "trust verdict" or "trust score" (context-dependent)
- "trust ratings" → "trust intelligence"
- "rating platform" → "trust oracle"
- "trust layer" → "trust oracle"

- [ ] **Step 2: Update api-docs.tsx intro section**

The API docs page likely has hardcoded intro text in addition to what comes from content-zones.ts. Find and update any "trust rating" references. The page should clearly distinguish:
- **Ecosystem Analytics (Free)** — aggregate data, no auth
- **Trust Intelligence (x402)** — per-agent, paid

Add a prominent link to the Trust API page at the top of the docs.

- [ ] **Step 3: Update status.tsx page title**

If the status page shows "Indexer Status" as a hardcoded title, update to "Oracle Status" to match the nav label.

- [ ] **Step 4: Commit all page updates**

```bash
git add client/src/pages/
git commit -m "pages: update hardcoded copy across all pages for oracle positioning

- Replace 'trust rating(s)' with 'trust verdict/intelligence/oracle'
- Update api-docs intro to distinguish free analytics vs paid intelligence
- Status page: 'Oracle Status' title
- All SEO descriptions updated via content-zones.ts (Task 1)"
```

---

### Task 10: Visual Verification

- [ ] **Step 1: Start dev server and check all pages**

Run: `cd /Users/ethserver/CLAUDE/trustadd && npm run dev`

Check each page loads without errors:
1. `/` — Hero says "Trust Oracle for the Agent Economy"
2. `/agents` — Directory loads
3. `/trust-api` — New page renders with pricing cards and demo
4. `/analytics` — Analytics loads with updated subtitle
5. `/economy` — Economy loads
6. `/about` — Updated mission text
7. `/api-docs` — Updated intro
8. `/status` — "Oracle Status" if applicable
9. Nav: 4 items (Agents, Analytics dropdown, Trust API, About dropdown)
10. Footer: "The trust oracle for the agent economy."

- [ ] **Step 2: Check for console errors**

Open browser dev tools, navigate through all pages. No React errors, no 404s for the new route.

- [ ] **Step 3: Verify Trust API demo works**

On `/trust-api`, enter an address like `0x0000000000000000000000000000000000000001` — should show "not found." Enter a real agent address from the directory — should show verdict badge.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "verify: all pages render correctly with oracle positioning"
```

---

### Task 11: Update Memory and Documentation

- [ ] **Step 1: Update project memory**

Update the next-tasks memory file to reflect this work is complete and note the new positioning.

- [ ] **Step 2: Final deployment**

```bash
npx vercel deploy --prod
```

Verify the production site at trustadd.com shows the updated positioning.

---

## Summary of Content Zone Changes

| Zone | File | Old Copy | New Copy |
|------|------|----------|----------|
| Site title | `index.html` | "Trust Ratings for AI Agents" | "The Trust Oracle for the Agent Economy" |
| Hero tag | `content-zones.ts` HOME | "AI Agent Trust Ratings" | "The Trust Oracle for the Agent Economy" |
| Hero title | `content-zones.ts` HOME | "Trust Ratings for AI Agents" | "The Trust Oracle for the Agent Economy" |
| Hero subtitle | `content-zones.ts` HOME | "Indexing identity, reputation..." | "Before your agent transacts, it checks TrustAdd..." |
| Feature 1 | `content-zones.ts` HOME | "Multi-Protocol Discovery" | "Trust Intelligence On Demand" |
| Feature 2 | `content-zones.ts` HOME | "Transparent Trust Scores" | "Cross-Layer Intelligence" |
| Feature 3 | `content-zones.ts` HOME | "Human & Machine Readable" | "Built for Agents, Readable by Humans" |
| Pillars heading | `content-zones.ts` HOME | "Three Pillars of Agent Trust" | "Five Dimensions of Agent Trust" |
| API section | `content-zones.ts` HOME | "API & Trust Reports" | "Trust Oracle API" |
| Stats label | `content-zones.ts` STATS | "TrustAdd Verified" | "Oracle Verified" |
| Footer tagline | `content-zones.ts` NAV | "Neutral public infrastructure for AI agent trust ratings." | "The trust oracle for the agent economy." |
| About subtitle | `content-zones.ts` ABOUT | "Trust ratings for AI agents..." | "The trust oracle for the agent economy..." |
| About mission | `content-zones.ts` ABOUT | "universal trust layer" | "trust oracle — agents query us before transacting" |
| Principle 2 | `content-zones.ts` ABOUT | "Open Ecosystem" | "Open Ecosystem, Paid Intelligence" |
| Analytics subtitle | `content-zones.ts` ANALYTICS | "Live insights across all indexed..." | "Free, live insights across the AI agent economy" |
| Status title | `content-zones.ts` STATUS | "Indexer Status" | "Oracle Status" |
| SEO landing | `content-zones.ts` SEO | "AI Agent Trust Ratings" | "The Trust Oracle for the Agent Economy" |
| Nav structure | `header.tsx` | 4 items + More dropdown | Agents \| Analytics (6 items) \| Trust API \| About (3 items) |
| New page | `trust-api.tsx` | N/A | Full product page with pricing, demo, integration |
