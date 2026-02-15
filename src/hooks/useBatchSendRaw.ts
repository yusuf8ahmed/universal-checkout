/**
 * Raw signing workaround for batch transactions with Privy embedded wallets.
 *
 * Flow:
 * 1. Build Tempo transaction envelope with calls array
 * 2. Get sign payload hash via TransactionEnvelopeTempo.getSignPayload()
 * 3. Sign hash with Privy's secp256k1_sign
 * 4. Serialize signed tx and broadcast via eth_sendRawTransaction
 */

import { alphaUsd } from "@/constants";
import { useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { tempoActions, Abis, Chain } from "tempo.ts/viem";
import { TransactionEnvelopeTempo, SignatureEnvelope } from "tempo.ts/ox";

// Define Tempo Moderato chain with proper formatters
const tempoModerato = Chain.define({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: { default: { http: ["https://rpc.moderato.tempo.xyz"] } },
  feeToken: alphaUsd,
})();

export interface Recipient {
  email: string;
  amount: string;
}

export interface BatchRawResult {
  txHash: string | null;
  status: "idle" | "building" | "signing" | "broadcasting" | "success" | "error";
  error: string | null;
}

export function useBatchSendRaw() {
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const [subStep, setSubStep] = useState<BatchRawResult["status"]>("idle");

  const mutation = useMutation({
    mutationFn: async (recipients: Recipient[]): Promise<string> => {
      setSubStep("building");

      // Find the Privy embedded wallet (not MetaMask or other injected wallets)
      const wallet = wallets.find((w) => w.walletClientType === "privy");
      if (!wallet?.address) {
        throw new Error(
          "No Privy embedded wallet found. Login with email/SMS to use batch transactions."
        );
      }

      // 1. Switch chain and get provider
      await wallet.switchChain(tempoModerato.id);
      const provider = await wallet.getEthereumProvider();

      // 2. Create public client for RPC calls
      const publicClient = createPublicClient({
        chain: tempoModerato,
        transport: http("https://rpc.moderato.tempo.xyz"),
      }).extend(tempoActions());

      // 3. Resolve addresses and get token metadata
      const addresses = await Promise.all(
        recipients.map((r) => resolveAddress(r.email))
      );
      const metadata = await publicClient.token.getMetadata({ token: alphaUsd });

      // 4. Build calls array
      const calls = recipients.map((recipient, i) => ({
        to: alphaUsd as Address,
        data: encodeFunctionData({
          abi: Abis.tip20,
          functionName: "transfer",
          args: [addresses[i], parseUnits(recipient.amount, metadata.decimals)],
        }),
      }));

      // 5. Get gas estimate
      const gasEstimate = await publicClient.estimateGas({
        account: wallet.address as Address,
        to: calls[0].to,
        data: calls[0].data,
      });

      // 6. Get fee data
      const feeData = await publicClient.estimateFeesPerGas();

      // 7. Get nonce
      const nonce = await publicClient.getTransactionCount({
        address: wallet.address as Address,
      });

      // 8. Build Tempo transaction envelope
      const envelope = TransactionEnvelopeTempo.from({
        chainId: tempoModerato.id,
        calls,
        nonce: BigInt(nonce),
        gas: gasEstimate * 2n, // Buffer for batch
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        feeToken: alphaUsd as Address,
      });

      // 9. Get sign payload (the hash to sign)
      const signPayload = TransactionEnvelopeTempo.getSignPayload(envelope);

      setSubStep("signing");

      // 10. Sign the hash with secp256k1_sign
      const rawSignature = await provider.request({
        method: "secp256k1_sign",
        params: [signPayload],
      });

      // 11. Parse signature into r, s, v components
      const signature = parseSignature(rawSignature);

      // 12. Serialize the signed transaction
      const signedTx = TransactionEnvelopeTempo.serialize(envelope, {
        signature: SignatureEnvelope.from({
          type: "secp256k1",
          signature: {
            r: BigInt(signature.r),
            s: BigInt(signature.s),
            yParity: signature.yParity,
          },
        }),
      });

      setSubStep("broadcasting");

      // 13. Broadcast via eth_sendRawTransaction directly to Tempo RPC
      const response = await fetch("https://rpc.moderato.tempo.xyz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_sendRawTransaction",
          params: [signedTx],
          id: 1,
        }),
      });

      const rpcResult = await response.json();

      if (rpcResult.error) {
        throw new Error(rpcResult.error.message || "RPC error");
      }

      return rpcResult.result as string;
    },
    onSuccess: () => {
      setSubStep("success");
      queryClient.invalidateQueries({ queryKey: ["multiTokenBalance"] });
      queryClient.invalidateQueries({ queryKey: ["transactionHistory"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
    },
    onError: () => {
      setSubStep("error");
    },
  });

  const result: BatchRawResult = {
    txHash: mutation.data ?? null,
    status: mutation.isPending
      ? subStep
      : mutation.isSuccess
        ? "success"
        : mutation.isError
          ? "error"
          : "idle",
    error: mutation.error?.message ?? null,
  };

  const reset = () => {
    mutation.reset();
    setSubStep("idle");
  };

  return { sendBatch: mutation.mutateAsync, result, reset };
}

// Parse secp256k1 signature from Privy format to r, s, yParity
function parseSignature(sig: Hex): { r: Hex; s: Hex; yParity: 0 | 1 } {
  // Remove 0x prefix
  const sigHex = sig.slice(2);

  // Standard signature format: r (32 bytes) + s (32 bytes) + v (1 byte)
  const r = `0x${sigHex.slice(0, 64)}` as Hex;
  const s = `0x${sigHex.slice(64, 128)}` as Hex;
  const v = parseInt(sigHex.slice(128, 130), 16);

  // v is typically 27 or 28, convert to yParity (0 or 1)
  const yParity = (v === 27 || v === 0 ? 0 : 1) as 0 | 1;

  return { r, s, yParity };
}

async function resolveAddress(identifier: string): Promise<Address> {
  const res = await fetch("/api/find", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier }),
  });

  if (!res.ok) {
    throw new Error("Failed to find user");
  }

  const data = (await res.json()) as { address: Address };
  return data.address;
}
