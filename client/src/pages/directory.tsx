import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAllChains } from "@shared/chains";
import { Layout } from "@/components/layout";
import { AgentCard, AgentCardSkeleton } from "@/components/agent-card";
import type { AgentWithVerdict } from "@/components/agent-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Search, Bot, ChevronLeft, ChevronRight, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { SEO } from "@/components/seo";
import { DIRECTORY } from "@/lib/content-zones";
import { useIsMobile } from "@/hooks/use-mobile";

type FilterState = "all" | "has-metadata" | "x402-enabled" | "has-reputation" | "has-feedback";
type SortState = "newest" | "oldest" | "name";

const PAGE_SIZE = 20;

const chains = getAllChains();

const FILTER_OPTIONS: { key: FilterState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "has-metadata", label: "Metadata" },
  { key: "x402-enabled", label: "x402" },
  { key: "has-reputation", label: "Reputation" },
  { key: "has-feedback", label: "Feedback" },
];

const SORT_OPTIONS: { key: SortState; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "name", label: "Name" },
];

export default function Directory() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [sort, setSort] = useState<SortState>("newest");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchTimer, setSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [qualityGate, setQualityGate] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer) clearTimeout(searchTimer);
    setSearchTimer(
      setTimeout(() => {
        setDebouncedSearch(value);
        setPage(0);
      }, 300),
    );
  };

  const handleFilterChange = (f: FilterState) => {
    setFilter(f);
    setPage(0);
  };

  const handleChainFilterChange = (chainId: number | null) => {
    setChainFilter(chainId);
    setPage(0);
  };

  const handleQualityGateToggle = () => {
    setQualityGate((v) => !v);
    setPage(0);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (chainFilter !== null) count++;
    if (filter !== "all") count++;
    if (sort !== "newest") count++;
    if (!qualityGate) count++;
    return count;
  }, [chainFilter, filter, sort, qualityGate]);

  const activeChipFilters = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (chainFilter !== null) {
      const chain = chains.find((c) => c.chainId === chainFilter);
      chips.push({
        label: `Chain: ${chain?.name ?? chainFilter}`,
        onRemove: () => handleChainFilterChange(null),
      });
    }
    if (filter !== "all") {
      const opt = FILTER_OPTIONS.find((o) => o.key === filter);
      chips.push({
        label: `Filter: ${opt?.label ?? filter}`,
        onRemove: () => handleFilterChange("all"),
      });
    }
    if (sort !== "newest") {
      const opt = SORT_OPTIONS.find((o) => o.key === sort);
      chips.push({
        label: `Sort: ${opt?.label ?? sort}`,
        onRemove: () => { setSort("newest"); setPage(0); },
      });
    }
    if (!qualityGate) {
      chips.push({
        label: "Showing all agents",
        onRemove: () => { setQualityGate(true); setPage(0); },
      });
    }
    return chips;
  }, [chainFilter, filter, sort, qualityGate]);

  const offset = page * PAGE_SIZE;
  const params = new URLSearchParams();
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
  if (filter !== "all") params.set("filter", filter);
  if (chainFilter !== null) params.set("chainId", String(chainFilter));
  if (sort !== "newest") params.set("sort", sort);
  if (qualityGate) {
    params.set("excludeSpam", "true");
  }

  const { data, isLoading } = useQuery<{
    agents: AgentWithVerdict[];
    total: number;
    limit: number;
    offset: number;
  }>({
    queryKey: ["/api/agents", { limit: PAGE_SIZE, offset, search: debouncedSearch, filter, chainId: chainFilter, sort, qualityGate }],
    queryFn: () => fetch(`/api/agents?${params.toString()}`).then((r) => r.json()),
  });

  const { data: totalAllData } = useQuery<{ total: number }>({
    queryKey: ["/api/agents/count-all"],
    queryFn: () => fetch("/api/agents?limit=1").then((r) => r.json()),
    staleTime: 60_000,
    enabled: qualityGate,
  });

  const { data: filterCounts } = useQuery<{
    total: number;
    hasMetadata: number;
    x402Enabled: number;
    hasReputation: number;
    hasFeedback: number;
  }>({
    queryKey: ["/api/stats/filters", qualityGate],
    queryFn: async () => {
      const baseParams = qualityGate ? "excludeSpam=true" : "";
      const sep = baseParams ? "&" : "";
      const [all, hasMeta, x402, hasRep, hasFeedback] = await Promise.all([
        fetch(`/api/agents?limit=1${baseParams ? "&" + baseParams : ""}`).then((r) => r.json()),
        fetch(`/api/agents?limit=1&filter=has-metadata${sep}${baseParams}`).then((r) => r.json()),
        fetch(`/api/agents?limit=1&filter=x402-enabled${sep}${baseParams}`).then((r) => r.json()),
        fetch(`/api/agents?limit=1&filter=has-reputation${sep}${baseParams}`).then((r) => r.json()),
        fetch(`/api/agents?limit=1&filter=has-feedback${sep}${baseParams}`).then((r) => r.json()),
      ]);
      return {
        total: all.total,
        hasMetadata: hasMeta.total,
        x402Enabled: x402.total,
        hasReputation: hasRep.total,
        hasFeedback: hasFeedback.total,
      };
    },
    staleTime: 60_000,
  });

  const agentList = data?.agents ?? [];
  const total = data?.total ?? 0;
  const totalAll = totalAllData?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const filterCountMap: Record<FilterState, number> = {
    all: filterCounts?.total ?? 0,
    "has-metadata": filterCounts?.hasMetadata ?? 0,
    "x402-enabled": filterCounts?.x402Enabled ?? 0,
    "has-reputation": filterCounts?.hasReputation ?? 0,
    "has-feedback": filterCounts?.hasFeedback ?? 0,
  };

  const filterControls = (
    <div className="space-y-4">
      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Chain</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant={chainFilter === null ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => handleChainFilterChange(null)}
            data-testid="button-chain-all"
          >
            All
          </Button>
          {chains.map((chain) => (
            <Button
              key={chain.chainId}
              variant={chainFilter === chain.chainId ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={() => handleChainFilterChange(chain.chainId)}
              data-testid={`button-chain-${chain.shortName}`}
            >
              <span
                className="inline-flex items-center justify-center rounded-full font-bold"
                style={{
                  backgroundColor: chain.color,
                  color: "white",
                  width: "14px",
                  height: "14px",
                  fontSize: "8px",
                }}
              >
                {chain.iconLetter}
              </span>
              {chain.name}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Filter</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => handleFilterChange(key)}
              data-testid={`button-filter-${key}`}
            >
              {label}
              <span className="text-[10px] opacity-60">{filterCountMap[key].toLocaleString()}</span>
            </Button>
          ))}
        </div>
      </div>

      <div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Sort</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SORT_OPTIONS.map(({ key, label }) => (
            <Button
              key={key}
              variant={sort === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setSort(key); setPage(0); }}
              data-testid={`button-sort-${key}`}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={handleQualityGateToggle}
          className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
            qualityGate
              ? "bg-primary/10 border-primary/30 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
          data-testid="button-quality-gate"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Verified only
        </button>
      </div>
    </div>
  );

  return (
    <Layout>
      <SEO
        title={DIRECTORY.seo.title}
        description={DIRECTORY.seo.description}
        path="/agents"
      />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-directory-title">
              Agent Directory
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {DIRECTORY.subtitle(total, chains.length)}
              {qualityGate && totalAll > 0 && total < totalAll && (
                <button
                  onClick={handleQualityGateToggle}
                  className="ml-1.5 text-primary hover:underline"
                  data-testid="button-show-all-agents"
                >
                  · Show all {totalAll.toLocaleString()}
                </button>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search agents..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
            {isMobile && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 flex-shrink-0" data-testid="button-open-filters">
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="default" className="h-5 min-w-5 px-1 text-[10px] rounded-full">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    {filterControls}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>

        {isMobile && activeChipFilters.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-none" data-testid="active-filter-chips">
            {activeChipFilters.map((chip) => (
              <Badge
                key={chip.label}
                variant="secondary"
                className="flex-shrink-0 gap-1 text-xs cursor-pointer"
                onClick={chip.onRemove}
                data-testid={`chip-${chip.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                {chip.label}
                <X className="w-3 h-3" />
              </Badge>
            ))}
          </div>
        )}

        {!isMobile && (
          <Card className="p-3 mb-6" data-testid="card-filters">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Chain</span>
                <Button
                  variant={chainFilter === null ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleChainFilterChange(null)}
                  data-testid="button-chain-all"
                >
                  All
                </Button>
                {chains.map((chain) => (
                  <Button
                    key={chain.chainId}
                    variant={chainFilter === chain.chainId ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => handleChainFilterChange(chain.chainId)}
                    data-testid={`button-chain-${chain.shortName}`}
                  >
                    <span
                      className="inline-flex items-center justify-center rounded-full font-bold"
                      style={{
                        backgroundColor: chain.color,
                        color: "white",
                        width: "14px",
                        height: "14px",
                        fontSize: "8px",
                      }}
                    >
                      {chain.iconLetter}
                    </span>
                    <span>{chain.name}</span>
                  </Button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Filter</span>
                  {FILTER_OPTIONS.map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={filter === key ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleFilterChange(key)}
                      data-testid={`button-filter-${key}`}
                    >
                      {label}
                      <span className="text-[10px] opacity-60">{filterCountMap[key].toLocaleString()}</span>
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Sort</span>
                    {SORT_OPTIONS.map(({ key, label }) => (
                      <Button
                        key={key}
                        variant={sort === key ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { setSort(key); setPage(0); }}
                        data-testid={`button-sort-${key}`}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <button
                    onClick={handleQualityGateToggle}
                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                      qualityGate
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid="button-quality-gate"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified only
                  </button>
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {isLoading ? (
            <>
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </>
          ) : agentList.length > 0 ? (
            agentList.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))
          ) : (
            <Card className="p-12 col-span-full">
              <div className="flex flex-col items-center justify-center text-center">
                <Bot className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-sm mb-1">
                  {search.trim() ? "No agents match your search" : "No agents found"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {search.trim()
                    ? "Try a different search term or clear your filters."
                    : qualityGate
                    ? "No verified agents match your filters. Try turning off the verified filter."
                    : DIRECTORY.emptyState}
                </p>
                {(search.trim() || qualityGate) && (
                  <div className="flex gap-2 mt-3">
                    {search.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleSearchChange("");
                          setSearch("");
                          handleFilterChange("all");
                        }}
                        data-testid="button-clear-search"
                      >
                        Clear search
                      </Button>
                    )}
                    {qualityGate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleQualityGateToggle}
                        data-testid="button-disable-quality-gate"
                      >
                        Show all agents
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-muted-foreground" data-testid="text-pagination-info">
              Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()} agents
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2" data-testid="text-page-number">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                data-testid="button-next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
