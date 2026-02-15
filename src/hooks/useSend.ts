import { alphaUsd } from "@/constants";
import { useWallets } from "@privy-io/react-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tempoActions } from "tempo.ts/viem";
import {
  createWalletClient,
  createPublicClient,
  custom,
  defineChain,
  http,
  parseUnits,
  stringToHex,
  walletActions,
  type Address,
} from "viem";

// Define Tempo Moderato chain
const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  feeToken: alphaUsd,
});

interface SendParams {
  to: string;
  amount: string;
  memo?: string;
}

async function executeSend(
  wallets: ReturnType<typeof useWallets>["wallets"],
  { to, amount, memo = "" }: SendParams
): Promise<string> {
  // Use the Privy embedded wallet, not MetaMask
  const wallet = wallets.find((w) => w.walletClientType === "privy");
  if (!wallet?.address) {
    throw new Error("No Privy embedded wallet found");
  }

  // Switch wallet to Tempo Moderato chain
  await wallet.switchChain(tempoModerato.id);

  const provider = await wallet.getEthereumProvider();

  // Use HTTP transport for reads (doesn't depend on wallet's chain)
  const publicClient = createPublicClient({
    chain: tempoModerato,
    transport: http("https://rpc.moderato.tempo.xyz"),
  }).extend(tempoActions());

  const client = createWalletClient({
    account: wallet.address as Address,
    chain: tempoModerato,
    transport: custom(provider),
  })
    .extend(walletActions)
    .extend(tempoActions());

  const metadata = await publicClient.token.getMetadata({
    token: alphaUsd,
  });
  const recipient = await getAddress(to);
  const { receipt } = await client.token.transferSync({
    to: recipient,
    amount: parseUnits(amount, metadata.decimals),
    memo: stringToHex(memo || to),
    token: alphaUsd,
  });

  return receipt.transactionHash;
}

export function useSend() {
  const { wallets } = useWallets();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (params: SendParams) => executeSend(wallets, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["multiTokenBalance"] });
      queryClient.invalidateQueries({ queryKey: ["transactionHistory"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
  });

  return {
    send: (to: string, amount: string, memo: string = "") =>
      mutation.mutateAsync({ to, amount, memo }),
    isSending: mutation.isPending,
    error: mutation.error?.message ?? null,
    txHash: mutation.data ?? null,
    reset: mutation.reset,
  };
}

async function getAddress(to: string): Promise<Address> {
  const res = await fetch("/api/find", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ identifier: to }),
  });

  if (!res.ok) {
    throw new Error("Failed to find user");
  }

  const data = (await res.json()) as { address: Address };
  return data.address;
}
