import { useQuery } from "@tanstack/react-query";

interface MppDirectoryStats {
  totalServices: number;
  activeServices: number;
  categoryBreakdown: Record<string, number>;
  pricingModelBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  priceStats: { median: number; mean: number; min: number; max: number } | null;
  snapshotDate: string | null;
}

interface MppAdoptionStats {
  mpp: number;
  x402: number;
  both: number;
}

interface MppChainStats {
  volume: number;
  txCount: number;
  uniquePayers: number;
  activeRecipients: number;
}

export default function MppPage() {
  const { data: stats } = useQuery<MppDirectoryStats>({
    queryKey: ["/api/mpp/directory/stats"],
  });
  const { data: adoption } = useQuery<MppAdoptionStats>({
    queryKey: ["/api/mpp/adoption"],
  });
  const { data: chain } = useQuery<MppChainStats>({
    queryKey: ["/api/mpp/chain/stats"],
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">MPP Ecosystem Overview</h1>
        <p className="text-muted-foreground mt-2">
          Machine Payments Protocol — Stripe + Tempo Labs agent payment standard
        </p>
        {stats?.snapshotDate && (
          <p className="text-sm text-muted-foreground mt-1">Latest snapshot: {stats.snapshotDate}</p>
        )}
      </header>

      {/* Hero stats */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Services Indexed</div>
          <div className="text-2xl font-semibold">{stats?.totalServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-semibold">{stats?.activeServices ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Tempo pathUSD Volume</div>
          <div className="text-2xl font-semibold">${chain?.volume?.toFixed(2) ?? "—"}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Multi-Protocol Agents</div>
          <div className="text-2xl font-semibold">{adoption?.both ?? "—"}</div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Category Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {stats && Object.entries(stats.categoryBreakdown).map(([cat, n]) => (
            <div key={cat} className="border rounded p-3">
              <div className="text-xs text-muted-foreground">{cat}</div>
              <div className="text-lg font-medium">{n}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Payment Methods</h2>
        <div className="flex flex-wrap gap-3">
          {stats && Object.entries(stats.paymentMethodBreakdown).map(([method, n]) => (
            <div key={method} className="px-3 py-2 border rounded bg-muted">
              <span className="font-medium">{method}</span>
              <span className="text-muted-foreground ml-2">{n} services</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Cross-Protocol Adoption</h2>
        <div className="border rounded-lg p-4">
          <p>
            <strong>{adoption?.mpp ?? 0}</strong> agents on MPP · <strong>{adoption?.x402 ?? 0}</strong> agents on x402
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>{adoption?.both ?? 0}</strong> agents present on both protocols — the strongest multi-protocol trust signal.
          </p>
        </div>
      </section>
    </div>
  );
}
