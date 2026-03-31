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
            Neutral public infrastructure for AI agent trust ratings.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="/api/agents"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-api"
            >
              API
            </a>
            <span className="text-xs text-muted-foreground">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
