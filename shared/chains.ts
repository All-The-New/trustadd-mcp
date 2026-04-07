export interface ChainConfig {
  chainId: number;
  name: string;
  shortName: string;
  explorerUrl: string;
  explorerName: string;
  rpcUrlTemplates: { provider: string; template: string }[];
  deploymentBlock: number;
  identityRegistry: string;
  reputationRegistry: string;
  color: string;
  bgColor: string;
  iconLetter: string;
  backfillBlockRange?: number;
  disabled?: boolean;
}

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

export const CHAIN_CONFIGS: Record<number, ChainConfig> = {
  1: {
    chainId: 1,
    name: "Ethereum",
    shortName: "eth",
    explorerUrl: "https://etherscan.io",
    explorerName: "Etherscan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://eth-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://rpc.ankr.com/eth" },
      { provider: "infura", template: "https://mainnet.infura.io/v3/{key}" },
    ],
    deploymentBlock: 21_700_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#627EEA",
    bgColor: "rgba(98, 126, 234, 0.1)",
    iconLetter: "E",
  },
  56: {
    chainId: 56,
    name: "BNB Chain",
    shortName: "bnb",
    explorerUrl: "https://bscscan.com",
    explorerName: "BscScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://bnb-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://rpc.ankr.com/bsc" },
      { provider: "public", template: "https://bsc-dataseed.binance.org/" },
      { provider: "public", template: "https://bsc-dataseed1.defibit.io/" },
    ],
    deploymentBlock: 46_000_000,
    backfillBlockRange: 1_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#F0B90B",
    bgColor: "rgba(240, 185, 11, 0.1)",
    iconLetter: "B",
  },
  137: {
    chainId: 137,
    name: "Polygon",
    shortName: "polygon",
    explorerUrl: "https://polygonscan.com",
    explorerName: "PolygonScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://polygon-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://rpc.ankr.com/polygon" },
      { provider: "infura", template: "https://polygon-mainnet.infura.io/v3/{key}" },
      { provider: "public", template: "https://polygon-bor-rpc.publicnode.com" },
      { provider: "public", template: "https://polygon.drpc.org" },
    ],
    deploymentBlock: 67_000_000,
    backfillBlockRange: 10_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#8247E5",
    bgColor: "rgba(130, 71, 229, 0.1)",
    iconLetter: "P",
  },
  42161: {
    chainId: 42161,
    name: "Arbitrum",
    shortName: "arb",
    explorerUrl: "https://arbiscan.io",
    explorerName: "Arbiscan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://arb-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://rpc.ankr.com/arbitrum" },
      { provider: "infura", template: "https://arbitrum-mainnet.infura.io/v3/{key}" },
      { provider: "public", template: "https://arb1.arbitrum.io/rpc" },
    ],
    deploymentBlock: 290_000_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#28A0F0",
    bgColor: "rgba(40, 160, 240, 0.1)",
    iconLetter: "A",
  },
  8453: {
    chainId: 8453,
    name: "Base",
    shortName: "base",
    explorerUrl: "https://basescan.org",
    explorerName: "BaseScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://base-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://mainnet.base.org" },
      { provider: "public", template: "https://rpc.ankr.com/base" },
      { provider: "infura", template: "https://base-mainnet.infura.io/v3/{key}" },
    ],
    deploymentBlock: 25_000_000,
    backfillBlockRange: 10_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#0052FF",
    bgColor: "rgba(0, 82, 255, 0.1)",
    iconLetter: "B",
  },
  42220: {
    chainId: 42220,
    name: "Celo",
    shortName: "celo",
    explorerUrl: "https://celoscan.io",
    explorerName: "CeloScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://celo-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://forno.celo.org" },
      { provider: "public", template: "https://rpc.ankr.com/celo" },
    ],
    deploymentBlock: 58_396_700,
    backfillBlockRange: 10_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#35D07F",
    bgColor: "rgba(53, 208, 127, 0.1)",
    iconLetter: "C",
  },
  100: {
    chainId: 100,
    name: "Gnosis",
    shortName: "gnosis",
    explorerUrl: "https://gnosisscan.io",
    explorerName: "GnosisScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://gnosis-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://rpc.gnosischain.com" },
      { provider: "public", template: "https://rpc.ankr.com/gnosis" },
    ],
    deploymentBlock: 44_505_000,
    backfillBlockRange: 10_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#04795B",
    bgColor: "rgba(4, 121, 91, 0.1)",
    iconLetter: "G",
  },
  10: {
    chainId: 10,
    name: "Optimism",
    shortName: "opt",
    explorerUrl: "https://optimistic.etherscan.io",
    explorerName: "Etherscan (Optimism)",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://opt-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://mainnet.optimism.io" },
      { provider: "public", template: "https://rpc.ankr.com/optimism" },
      { provider: "infura", template: "https://optimism-mainnet.infura.io/v3/{key}" },
    ],
    deploymentBlock: 147_514_900,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#FF0420",
    bgColor: "rgba(255, 4, 32, 0.1)",
    iconLetter: "O",
  },
  43114: {
    chainId: 43114,
    name: "Avalanche",
    shortName: "avax",
    explorerUrl: "https://snowscan.xyz",
    explorerName: "SnowScan",
    rpcUrlTemplates: [
      { provider: "alchemy", template: "https://avax-mainnet.g.alchemy.com/v2/{key}" },
      { provider: "public", template: "https://api.avax.network/ext/bc/C/rpc" },
      { provider: "public", template: "https://rpc.ankr.com/avalanche" },
      { provider: "infura", template: "https://avalanche-mainnet.infura.io/v3/{key}" },
    ],
    deploymentBlock: 77_389_000,
    backfillBlockRange: 5_000,
    identityRegistry: IDENTITY_REGISTRY,
    reputationRegistry: REPUTATION_REGISTRY,
    color: "#E84142",
    bgColor: "rgba(232, 65, 66, 0.1)",
    iconLetter: "A",
  },
};

/** Derived chain color map — auto-synced from CHAIN_CONFIGS. Use in charts/visualizations. */
export const CHAIN_COLORS: Record<number, string> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((c) => [c.chainId, c.color]),
);

/** Derived chain name map — auto-synced from CHAIN_CONFIGS. Use in charts/visualizations. */
export const CHAIN_NAMES: Record<number, string> = Object.fromEntries(
  Object.values(CHAIN_CONFIGS).map((c) => [c.chainId, c.name]),
);

export function getChain(chainId: number): ChainConfig | undefined {
  return CHAIN_CONFIGS[chainId];
}

export function getAllChains(): ChainConfig[] {
  return Object.values(CHAIN_CONFIGS);
}

export function getExplorerTxUrl(chainId: number, txHash: string): string {
  const chain = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS[1];
  return `${chain.explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressUrl(chainId: number, address: string): string {
  const chain = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS[1];
  return `${chain.explorerUrl}/address/${address}`;
}

export function getExplorerBlockUrl(chainId: number, blockNumber: number): string {
  const chain = CHAIN_CONFIGS[chainId] || CHAIN_CONFIGS[1];
  return `${chain.explorerUrl}/block/${blockNumber}`;
}

const RPC_KEY_MAP: Record<string, string | null> = {
  alchemy: "API_KEY_ALCHEMY",
  infura: "API_KEY_INFURA",
  public: null,
};

export function getEnabledChains(): ChainConfig[] {
  return getAllChains().filter((chain) => {
    if (chain.disabled) return false;
    return chain.rpcUrlTemplates.some((t) => {
      const envVarName = RPC_KEY_MAP[t.provider];
      if (envVarName === null) return true;
      return envVarName && process.env[envVarName];
    });
  });
}

export function getRpcUrls(chain: ChainConfig): { primary: string; fallbacks: string[] } {
  const urls: string[] = [];
  for (const t of chain.rpcUrlTemplates) {
    const envVarName = RPC_KEY_MAP[t.provider];
    if (envVarName === null) {
      urls.push(t.template);
    } else {
      const key = process.env[envVarName];
      if (key) urls.push(t.template.replace("{key}", key));
    }
  }
  return {
    primary: urls[0] || "",
    fallbacks: urls.slice(1),
  };
}
