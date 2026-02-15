import { alphaUsd } from "@/constants";
import { useQuery } from "@tanstack/react-query";
import { Abis } from "tempo.ts/viem";
import { Address, createPublicClient, defineChain, formatUnits, http } from "viem";

const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  feeToken: alphaUsd,
});

const publicClient = createPublicClient({
  chain: tempoModerato,
  transport: http("https://rpc.moderato.tempo.xyz"),
});

interface BalanceResult {
  balance: string;
  symbol: string;
}

async function fetchBalance(address: string): Promise<BalanceResult> {
  const [balanceResult, decimalsResult, symbolResult] = await Promise.all([
    publicClient.readContract({
      address: alphaUsd,
      abi: Abis.tip20,
      functionName: "balanceOf",
      args: [address as Address],
    }),
    publicClient.readContract({
      address: alphaUsd,
      abi: Abis.tip20,
      functionName: "decimals",
    }),
    publicClient.readContract({
      address: alphaUsd,
      abi: Abis.tip20,
      functionName: "symbol",
    }),
  ]);

  const balance = balanceResult as unknown as bigint;
  const decimals = decimalsResult as unknown as number;
  const symbol = symbolResult as unknown as string;

  const formatted = formatUnits(balance, decimals);
  const number = parseFloat(formatted);

  let displayBalance: string;
  if (number >= 1_000_000) {
    displayBalance = (number / 1_000_000).toFixed(2) + "M";
  } else if (number >= 1_000) {
    displayBalance = (number / 1_000).toFixed(2) + "K";
  } else {
    displayBalance = number.toFixed(2);
  }

  return { balance: displayBalance, symbol };
}

export function useBalance(address: string | undefined) {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["balance", address],
    queryFn: () => fetchBalance(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  return {
    balance: data?.balance ?? "0.00",
    symbol: data?.symbol ?? "",
    loading,
  };
}
