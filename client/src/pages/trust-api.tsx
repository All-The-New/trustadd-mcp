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
  Zap,
  FileText,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Search,
} from "lucide-react";
import { TrustStamp } from "@/components/trust-stamp";
import { verdictDescriptor, type PublicVerdict, UNKNOWN_ICON } from "@/lib/verdict";

function VerdictBadge({ verdict }: { verdict: PublicVerdict }) {
  const desc = verdictDescriptor(verdict);
  const Icon = verdict === "UNKNOWN" ? UNKNOWN_ICON : desc.icon;
  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{ background: desc.tintBg, color: desc.color, borderColor: desc.color + "40" }}
    >
      <Icon className="w-3 h-3" />
      {verdict === "UNKNOWN" ? "UNKNOWN" : desc.label}
    </Badge>
  );
}

export default function TrustApi() {
  const [demoAddress, setDemoAddress] = useState("");
  const [searchAddress, setSearchAddress] = useState("");

  const { data: demoResult, isLoading: demoLoading } = useQuery({
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
            Micropayments — x402 or MPP
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Trust Oracle API
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Query agent trustworthiness before transacting. Pay per query via
            x402 (USDC on Base) or MPP (pathUSD on Tempo) — no API keys, no subscriptions.
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
              <p className="text-sm text-muted-foreground">per query · x402 or MPP</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Fast trust verdict for automated agent decisions. Returns score,
                verdict, tier, and flags in under 200ms (cached).
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  "Trust verdict (VERIFIED / TRUSTED / BUILDING / INSUFFICIENT / FLAGGED / UNKNOWN)",
                  "Composite score (0\u2013100)",
                  "Evidence basis summary",
                  "9 verification states (earned + unearned)",
                  "Confidence level",
                  "Methodology version + provenance hash",
                  "Category strengths (qualitative)",
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
              <p className="text-sm text-muted-foreground">per report · x402 or MPP</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Comprehensive trust evidence for due diligence. Full identity,
                economy, community signals, and on-chain history.
              </p>
              <ul className="space-y-2 text-sm">
                {[
                  "Everything in Quick Check",
                  "5 numeric category scores",
                  "21 individual signal scores",
                  "Sybil detection signals + dampening detail",
                  "Agent identity + metadata",
                  "Full transaction history + volume",
                  "GitHub health + Farcaster engagement",
                  "Per-chain transaction breakdown",
                  "Registration timeline + data freshness",
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
                    <div className="flex items-center gap-3">
                      <TrustStamp verdict={demoResult.verdict ?? "UNKNOWN"} score={demoResult.score ?? null} size="square" className="!w-12 !h-12" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{demoResult.name || "Unnamed Agent"}</div>
                        <div className="text-xs text-muted-foreground">{demoResult.evidenceSummary ?? "Profile data indexed."}</div>
                      </div>
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
        </div>

        {/* Response Shape */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">Response shape</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Quick Check — $0.01</h3>
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "address": "0x...",
  "verdict": "TRUSTED",
  "score": 72,
  "categoryStrengths": {
    "identity": "high",
    "behavioral": "medium",
    "community": "low",
    "authenticity": "high",
    "attestation": "none"
  },
  "evidenceBasis": {
    "transactionCount": 18,
    "uniquePayers": 7,
    "summary": "Based on 18 verified transactions ..."
  },
  "verificationCount": 5,
  "reportVersion": 4
}`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">Full Report — $0.05</h3>
              <pre className="text-[11px] font-mono bg-muted p-3 rounded-md overflow-x-auto">
{`{
  "trustRating": { "score": 72, "verdict": "TRUSTED",
    "breakdown": { "categories": { "transactions": 20, ... } },
    "categoryStrengths": { ... },
    "confidence": { "level": "medium" },
    "provenance": { "signalHash": "0x..." }
  },
  "verifications": [ { "name": "x402 Enabled", "earned": true }, ... ],
  "community": { "githubHealthScore": 68, ... },
  "economy": { "transactionCount": 18, "totalVolumeUsd": 125.42 },
  "sybil": { "riskScore": 0, "dampeningApplied": false }
}`}
              </pre>
            </div>
          </div>
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

        {/* How MPP Works */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center">How MPP Payment Works</h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Request", desc: "Agent calls the Trust endpoint" },
              { step: "2", title: "402 Response", desc: "Server returns WWW-Authenticate: Payment challenge" },
              { step: "3", title: "Pay", desc: "Agent sends pathUSD on Tempo (chain 4217) to listed recipient" },
              { step: "4", title: "Retry", desc: "Agent retries with Authorization: MPP 0x<txHash>" },
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
                <CardTitle className="text-lg">REST API + x402 / MPP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Direct HTTP integration. Pay with x402 (EIP-3009 USDC on Base, facilitator-settled) or MPP (pathUSD on Tempo chain 4217, direct transfer + tx-hash proof).
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
