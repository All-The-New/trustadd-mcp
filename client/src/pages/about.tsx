import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Target, Eye, Layers, MessageSquare, ArrowRight, Zap, FileCode, Wrench, Network } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ABOUT, PROTOCOLS, SEO as SEO_CONTENT } from "@/lib/content-zones";

const SCORE_CATEGORIES = [
  {
    name: "Identity",
    max: 25,
    color: "bg-blue-500",
    description: "Does the agent have a name, description, image, endpoints, and tags? Complete identity metadata signals a well-maintained agent.",
  },
  {
    name: "History",
    max: 20,
    color: "bg-purple-500",
    description: "How long has the agent been registered? Has its metadata been updated? Is it present on multiple chains? Longevity and activity build trust.",
  },
  {
    name: "Capability",
    max: 15,
    color: "bg-green-500",
    description: "Does the agent support x402 payments? Does it declare OASF skills? How many endpoints does it expose? Technical capability signals utility.",
  },
  {
    name: "Community",
    max: 20,
    color: "bg-amber-500",
    description: "What does the community say? GitHub stars, health scores, Farcaster followers, and engagement all contribute to the community signal.",
  },
  {
    name: "Transparency",
    max: 20,
    color: "bg-teal-500",
    description: "Is metadata stored on IPFS or a decentralized source? Are trust mechanisms declared? Is the agent marked as active? Transparency signals accountability.",
  },
];

const PROTOCOL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Zap,
  FileCode,
  Wrench,
  Network,
};

const PROTOCOL_CARDS = PROTOCOLS.items.filter(p => p.status === "live").slice(0, 5);

export default function About() {
  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.about.title}
        description={SEO_CONTENT.about.description}
        path="/about"
      />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-about-title">
            {ABOUT.header.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg leading-relaxed max-w-2xl">
            {ABOUT.header.subtitle}
          </p>
        </div>

        <section className="space-y-4" data-testid="section-mission">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">{ABOUT.mission.title}</h2>
          </div>
          <div className="text-muted-foreground space-y-3 leading-relaxed">
            {ABOUT.mission.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        <section className="space-y-4" data-testid="section-trust-score">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">{ABOUT.score.title}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {ABOUT.score.intro}
          </p>

          <div className="flex items-center gap-1 rounded-lg overflow-hidden h-6 mb-2">
            {SCORE_CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className={`${cat.color} h-full flex items-center justify-center text-[10px] font-bold text-white`}
                style={{ width: `${cat.max}%` }}
              >
                {cat.max}
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {SCORE_CATEGORIES.map((cat) => (
              <Card key={cat.name} data-testid={`card-score-category-${cat.name.toLowerCase()}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between gap-1">
                    <span className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${cat.color}`} />
                      {cat.name}
                    </span>
                    <Badge variant="outline" className="text-xs">{cat.max} pts</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 mt-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Score tiers:</strong>{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">70+</span> indicates high trust,{" "}
              <span className="text-amber-600 dark:text-amber-400 font-medium">40-69</span> indicates moderate trust, and{" "}
              <span className="text-red-500 font-medium">below 40</span> indicates limited trust signals.
              Scores update automatically as new data arrives — after indexer events, community feedback scrapes, and metadata changes.
            </p>
          </div>
        </section>

        <section className="space-y-4" data-testid="section-principles">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">{ABOUT.principles.title}</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {ABOUT.principles.items.map((item) => (
              <Card key={item.title}>
                <CardContent className="pt-4">
                  <h3 className="text-sm font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4" data-testid="section-protocols">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">{ABOUT.protocols.title}</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {ABOUT.protocols.intro}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PROTOCOL_CARDS.map((proto) => {
              const IconComponent = PROTOCOL_ICON_MAP[proto.icon];
              return (
                <Card key={proto.id} data-testid={`card-protocol-${proto.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      {IconComponent && <IconComponent className="w-4 h-4 text-primary" />}
                      <h3 className="text-sm font-semibold">{proto.name}</h3>
                      <Badge variant="outline" className="text-xs ml-auto">{proto.tagline}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      {proto.description.slice(0, 120)}...
                    </p>
                    <Link href="/protocols">
                      <Button variant="ghost" size="sm" className="gap-1 px-0" data-testid={`link-protocol-${proto.id}`}>
                        Learn More
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <div className="flex justify-center pt-2">
            <Link href="/protocols">
              <Button variant="outline" className="gap-2" data-testid="link-all-protocols">
                View All Protocols
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>

        <section className="space-y-4" data-testid="section-feedback">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Feedback</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            TrustAdd is a work in progress and we value your input. If you have ideas about the scoring methodology, want to suggest new data sources, or have feedback on the platform — we'd like to hear from you.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link href="/api-docs">
              <Button variant="outline" className="gap-2" data-testid="link-about-api">
                Explore the API
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="outline" className="gap-2" data-testid="link-about-analytics">
                View Analytics
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </Layout>
  );
}
