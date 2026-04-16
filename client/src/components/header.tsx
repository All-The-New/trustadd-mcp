import { Link, useLocation } from "wouter";
import { Shield, Bot, BarChart3, ChevronDown, Zap, Info, BookOpen, Layers, Activity, ShieldCheck, Sparkles, Store, Coins, FlaskConical, Scale, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "./theme-toggle";

const analyticsRoutes = ["/analytics", "/economy", "/skills", "/bazaar", "/mpp", "/status"];
const aboutRoutes = ["/about", "/protocols", "/api-docs", "/methodology", "/principles", "/quality"];

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
              {import.meta.env.VITE_ENABLE_MPP_UI === "true" && (
                <Link href="/mpp">
                  <DropdownMenuItem className="gap-2 cursor-pointer">
                    <Network className="w-4 h-4" />
                    MPP
                  </DropdownMenuItem>
                </Link>
              )}
              <Link href="/status">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Activity className="w-4 h-4" />
                  Oracle Status
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>

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
              <Link href="/principles">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Scale className="w-4 h-4" />
                  Principles
                </DropdownMenuItem>
              </Link>
              <Link href="/methodology">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <FlaskConical className="w-4 h-4" />
                  Methodology
                </DropdownMenuItem>
              </Link>
              <Link href="/quality">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <ShieldCheck className="w-4 h-4" />
                  Quality
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
