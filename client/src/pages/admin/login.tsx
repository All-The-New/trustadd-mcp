import { useState } from "react";
import { useLocation } from "wouter";
import { Shield, Lock, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { SEO } from "@/components/seo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: session } = useQuery<{ authenticated: boolean } | null>({
    queryKey: ["/api/admin/session"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (session?.authenticated) {
    setLocation("/admin");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        await queryClient.invalidateQueries({ queryKey: ["/api/admin/session"] });
        setLocation("/admin");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <SEO title="Admin Login" description="TrustAdd admin login" />
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="flex items-center gap-2 mb-8">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-2xl font-semibold tracking-tighter">TrustAdd</span>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> Admin Access
          </CardTitle>
          <CardDescription>Enter your admin password to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input type="password" placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoFocus disabled={loading} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !password}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Button variant="link" className="mt-4 text-xs text-muted-foreground"
        onClick={() => setLocation("/")}>Back to TrustAdd</Button>
    </div>
  );
}
