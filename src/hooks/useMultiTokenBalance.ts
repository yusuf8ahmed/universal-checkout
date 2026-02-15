import { TOKEN_LIST, TEMPO_RPC, type TokenInfo } from "@/constants";
import { useQuery } from "@tanstack/react-query";
import { Abis } from "tempo.ts/viem";
import {
  type Address,
  createPublicClient,
  defineChain,
  formatUnits,
  http,
} from "viem";
import { alphaUsd } from "@/constants";

const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: [TEMPO_RPC] },
  },
  feeToken: alphaUsd,
});

const publicClient = createPublicClient({
  chain: tempoModerato,
  transport: http(TEMPO_RPC),
});

export interface TokenBalance {
  token: TokenInfo;
  balance: bigint;
  formatted: string;
  display: string;
}

async function fetchBalances(address: string): Promise<TokenBalance[]> {
  const results = await Promise.all(
    TOKEN_LIST.map(async (token) => {
      try {
        const balance = (await publicClient.readContract({
          address: token.address,
          abi: Abis.tip20,
          functionName: "balanceOf",
          args: [address as Address],
        })) as unknown as bigint;

        const formatted = formatUnits(balance, token.decimals);
        const num = parseFloat(formatted);

        let display: string;
        if (num >= 1_000_000) {
          display = (num / 1_000_000).toFixed(2) + "M";
        } else if (num >= 1_000) {
          display = (num / 1_000).toFixed(2) + "K";
        } else {
          display = num.toFixed(2);
        }

        return { token, balance, formatted, display };
      } catch {
        return {
          token,
          balance: 0n,
          formatted: "0",
          display: "0.00",
        };
      }
    })
  );

  return results;
}

export function useMultiTokenBalance(address: string | undefined) {
  const { data: balances = [], isLoading: loading } = useQuery({
    queryKey: ["multiTokenBalance", address],
    queryFn: () => fetchBalances(address!),
    enabled: !!address,
    refetchInterval: 15_000,
  });

  return { balances, loading };
}
