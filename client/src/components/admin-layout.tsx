import { Link, useLocation } from "wouter";
import {
  Shield, LayoutDashboard, BarChart3, Activity,
  ScrollText, ListChecks, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./theme-toggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useEffect } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/usage", label: "API Usage", icon: BarChart3 },
  { href: "/admin/status", label: "Status Details", icon: Activity },
  { href: "/admin/tasks", label: "Task Monitor", icon: ListChecks },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: session, isLoading } = useQuery<{ authenticated: boolean; method?: string } | null>({
    queryKey: ["/api/admin/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
      setLocation("/admin/login");
    },
  });

  useEffect(() => {
    if (!isLoading && !session?.authenticated) {
      setLocation("/admin/login");
    }
  }, [isLoading, session, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session?.authenticated) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Admin header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
                  <Shield className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-semibold tracking-tighter">TrustAdd</span>
                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">Admin</span>
              </div>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button
                  variant={location === href ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                Public Site
              </Button>
            </Link>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="gap-1 text-muted-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button
                variant={location === href ? "secondary" : "ghost"}
                size="sm"
                className="gap-1 text-xs whitespace-nowrap"
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Button>
            </Link>
          ))}
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>

      <footer className="border-t bg-card/50">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            TrustAdd Admin {session.method === "ip-whitelist" ? "(IP Whitelisted)" : ""}
          </span>
          <span className="text-xs text-muted-foreground">v1.0</span>
        </div>
      </footer>
    </div>
  );
}
