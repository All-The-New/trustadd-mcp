import { Link, useLocation } from "wouter";
import { Shield, Bot, BarChart3, BookOpen, Activity, Info, Coins, Layers, ChevronDown, ShieldCheck, Sparkles, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const [location] = useLocation();

  const secondaryActive = ["/status", "/api-docs", "/about", "/quality", "/protocols", "/skills"].includes(location);

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
              variant={location === "/agents" ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-directory"
            >
              <Bot className="w-4 h-4" />
              <span className="hidden sm:inline">Agents</span>
            </Button>
          </Link>
          <Link href="/analytics">
            <Button
              variant={location === "/analytics" ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-analytics"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Analytics</span>
            </Button>
          </Link>
          <Link href="/economy">
            <Button
              variant={location === "/economy" ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-economy"
            >
              <Coins className="w-4 h-4" />
              <span className="hidden sm:inline">Economy</span>
            </Button>
          </Link>
          <Link href="/bazaar">
            <Button
              variant={location === "/bazaar" ? "secondary" : "ghost"}
              className="gap-2"
              data-testid="link-bazaar"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Bazaar</span>
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={secondaryActive ? "secondary" : "ghost"}
                className="gap-2"
                data-testid="dropdown-more"
              >
                <span className="hidden sm:inline">More</span>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <Link href="/skills">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-skills">
                  <Sparkles className="w-4 h-4" />
                  Skills
                </DropdownMenuItem>
              </Link>
              <Link href="/protocols">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-protocols">
                  <Layers className="w-4 h-4" />
                  Protocols
                </DropdownMenuItem>
              </Link>
              <Link href="/quality">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-quality">
                  <ShieldCheck className="w-4 h-4" />
                  Quality
                </DropdownMenuItem>
              </Link>
              <Link href="/status">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-status">
                  <Activity className="w-4 h-4" />
                  Status
                </DropdownMenuItem>
              </Link>
              <Link href="/api-docs">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-api-docs">
                  <BookOpen className="w-4 h-4" />
                  API
                </DropdownMenuItem>
              </Link>
              <Link href="/about">
                <DropdownMenuItem className="gap-2 cursor-pointer" data-testid="link-about">
                  <Info className="w-4 h-4" />
                  About
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
