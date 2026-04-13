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
