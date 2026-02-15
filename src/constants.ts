import { Address } from "viem";

// ── Token Addresses (Tempo Moderato Testnet) ──────────────────────────
export const alphaUsd =
  "0x20c0000000000000000000000000000000000001" as Address;
export const betaUsd =
  "0x20c0000000000000000000000000000000000002" as Address;
export const thetaUsd =
  "0x20c0000000000000000000000000000000000003" as Address;
export const pathUsd =
  "0x20c0000000000000000000000000000000000000" as Address;

// ── Token Metadata ────────────────────────────────────────────────────
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenInfo> = {
  alphaUsd: {
    address: alphaUsd,
    symbol: "aUSD",
    name: "AlphaUSD",
    decimals: 6,
  },
  betaUsd: {
    address: betaUsd,
    symbol: "bUSD",
    name: "BetaUSD",
    decimals: 6,
  },
  thetaUsd: {
    address: thetaUsd,
    symbol: "tUSD",
    name: "ThetaUSD",
    decimals: 6,
  },
  pathUsd: {
    address: pathUsd,
    symbol: "pUSD",
    name: "PathUSD",
    decimals: 6,
  },
};

// Ordered list for UI selectors
export const TOKEN_LIST: TokenInfo[] = [
  TOKENS.alphaUsd,
  TOKENS.betaUsd,
  TOKENS.thetaUsd,
  TOKENS.pathUsd,
];

// Address -> TokenInfo lookup
export const TOKEN_BY_ADDRESS: Record<string, TokenInfo> = Object.fromEntries(
  TOKEN_LIST.map((t) => [t.address.toLowerCase(), t])
);

// ── Chain Config ──────────────────────────────────────────────────────
export const TEMPO_CHAIN_ID = 42431;
export const TEMPO_RPC = "https://rpc.moderato.tempo.xyz";
export const TEMPO_EXPLORER = "https://explore.tempo.xyz";

// ── Fee Sponsor ───────────────────────────────────────────────────────
export const FEE_SPONSOR_URL = "https://sponsor.testnet.tempo.xyz";
