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
};

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
