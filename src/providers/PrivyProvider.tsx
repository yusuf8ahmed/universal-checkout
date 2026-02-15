"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";

const alphaUsd = "0x20c0000000000000000000000000000000000001";

// Define Tempo Moderato chain
const tempo = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
  feeToken: alphaUsd,
});

const queryClient = new QueryClient();

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  return (
    <BasePrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "sms", "wallet"],
        defaultChain: tempo,
        supportedChains: [tempo],
        appearance: {
          theme: "dark",
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "all-users" },
          showWalletUIs: false,
        },
      }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BasePrivyProvider>
  );
}
