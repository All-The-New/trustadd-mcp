import { useDeferredValue, useState } from "react";
import { Layout } from "@/components/layout";
import { SEO } from "@/components/seo";
import { useQuery } from "@tanstack/react-query";
import { MPP } from "@/lib/content-zones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  AreaChart, Area, ResponsiveContainer, Tooltip,
} from "recharts";
import {
  Store, DollarSign, Users, TrendingUp, AlertTriangle,
  Search, ChevronLeft, ChevronRight, Network, Coins,
} from "lucide-react";
import { Link } from "wouter";

// --- Category + payment method color tables ---

const CATEGORY_COLORS: Record<string, string> = {
  "ai-model": "#8b5cf6",
  "dev-infra": "#3b82f6",
  compute: "#f59e0b",
  data: "#22c55e",
  commerce: "#ec4899",
  other: "#6b7280",
};
const CATEGORY_LABELS: Record<string, string> = {
  "ai-model": "AI Models",
  "dev-infra": "Dev Infra",
  compute: "Compute",
  data: "Data",
  commerce: "Commerce",
  other: "Other",
};
const PAYMENT_METHOD_COLORS: Record<string, string> = {
  tempo: "#14b8a6",
  stripe: "#635bff",
  lightning: "#f7931a",
  other: "#6b7280",
};

// --- Primitives ---

function KpiCard({ label, value, icon: Icon, subtitle, iconColor }: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  subtitle?: string;
  iconColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight mt-0.5">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <Icon className={`w-10 h-10 ${iconColor ?? "text-muted-foreground"}`} strokeWidth={1.5} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold tracking-tight">{children}</h2>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function ChartSkeleton() {
  return <Skeleton className="w-full h-[280px] rounded-lg" />;
}

function ChartError({ message }: { message?: string }) {
  return (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>{message ?? "Failed to load data"}</AlertDescription>
    </Alert>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{message}</div>
  );
}

// --- Page ---

export default function MppPage() {
  return (
    <Layout>
      <SEO title={MPP.seo.title} description={MPP.seo.description} path="/mpp" />
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">{MPP.overview.title}</h1>
          <p className="text-muted-foreground mt-1">{MPP.overview.description}</p>
        </header>
        {/* Sections added in Tasks 5-12 */}
      </div>
    </Layout>
  );
}
