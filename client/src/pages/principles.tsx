import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Layers,
  FileText,
  AlertTriangle,
  Shield,
  Scale,
  BookOpen,
  GitBranch,
  Info,
  Network,
  ArrowRight,
} from "lucide-react";
import { Link } from "wouter";
import { PRINCIPLES, SEO as SEO_CONTENT } from "@/lib/content-zones";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye,
  Layers,
  FileText,
  AlertTriangle,
  Shield,
  Scale,
  BookOpen,
  GitBranch,
  Info,
  Network,
};

export default function Principles() {
  return (
    <Layout>
      <SEO
        title={SEO_CONTENT.principles.title}
        description={SEO_CONTENT.principles.description}
        path="/principles"
      />
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-12">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {PRINCIPLES.header.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg leading-relaxed max-w-2xl">
            {PRINCIPLES.header.subtitle}
          </p>
        </div>

        <div className="space-y-8">
          {PRINCIPLES.sections.map((section, idx) => {
            const IconComponent = ICON_MAP[section.icon];
            return (
              <section key={idx} className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10 shrink-0 mt-0.5">
                    {IconComponent && (
                      <IconComponent className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-xl font-semibold leading-tight">
                      {section.title}
                    </h2>
                    <div className="text-muted-foreground space-y-2 leading-relaxed">
                      {section.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </div>
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="py-3 px-4">
                        <p className="text-sm font-medium">
                          <span className="text-primary">Our commitment:</span>{" "}
                          {section.commitment}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-6 text-center space-y-3">
          <p className="text-lg font-semibold">
            {PRINCIPLES.closing.tagline}
          </p>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {PRINCIPLES.closing.body}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/methodology">
              <Button variant="outline" className="gap-2">
                Explore the Methodology
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/trust-api">
              <Button variant="outline" className="gap-2">
                View the Trust API
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
