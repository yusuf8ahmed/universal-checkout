/**
 * Hook for atomic swap + transfer with memo.
 *
 * When the payer's token matches the merchant's preferred token,
 * a simple transferWithMemo is executed.
 *
 * When they differ, an atomic batch transaction is built:
 *   1. approve(DEX, payerToken, maxAmountIn)
 *   2. sell(payerToken -> merchantToken)
 *   3. transferWithMemo(merchant, merchantToken, amount, memo)
 *
 * All calls use fee sponsorship (feePayer: true) for gasless UX.
 */

import { useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tempoActions, Abis } from "tempo.ts/viem";
import { TransactionEnvelopeTempo, SignatureEnvelope } from "tempo.ts/ox";
import { Chain } from "tempo.ts/viem";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { alphaUsd, TEMPO_RPC } from "@/constants";
import { invoiceMemo } from "@/lib/invoice";

// Tempo Moderato chain with formatters for raw transaction building
const tempoModerato = Chain.define({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: { default: { http: [TEMPO_RPC] } },
  feeToken: alphaUsd,
})();

// Stablecoin DEX precompile address (Tempo enshrined)
const STABLECOIN_DEX = "0xdec0000000000000000000000000000000000000" as Address;

export type SwapPayStatus =
  | "idle"
  | "quoting"
  | "building"
  | "signing"
  | "broadcasting"
  | "success"
  | "error";

export interface SwapPayResult {
  txHash: string | null;
  status: SwapPayStatus;
  error: string | null;
}

interface PayParams {
  merchantAddress: Address;
  amount: string;
  merchantToken: Address;
  payerToken: Address;
  reference: string;
  maxSlippage?: number;
}

export function useSwapAndPay() {
  const { wallets } = useWallets();
  const queryClient = useQueryClient();
  const [subStep, setSubStep] = useState<SwapPayStatus>("idle");

  const mutation = useMutation({
    mutationFn: async ({
      merchantAddress,
      amount,
      merchantToken,
      payerToken,
      reference,
      maxSlippage = 0.005, // 0.5% default
    }: PayParams): Promise<string> => {
      setSubStep("building");

      const wallet = wallets.find((w) => w.walletClientType === "privy");
      if (!wallet?.address) {
        throw new Error("No Privy embedded wallet found");
      }

      await wallet.switchChain(tempoModerato.id);
      const provider = await wallet.getEthereumProvider();

      const publicClient = createPublicClient({
        chain: tempoModerato,
        transport: http(TEMPO_RPC),
      }).extend(tempoActions());

      const memo = invoiceMemo(reference);
      const amountParsed = parseUnits(amount, 6); // All tokens are 6 decimals

      const sameToken =
        payerToken.toLowerCase() === merchantToken.toLowerCase();

      if (sameToken) {
        // ── Direct transfer with memo ──────────────────────────────
        const walletClient = createWalletClient({
          account: wallet.address as Address,
          chain: tempoModerato,
          transport: custom(provider),
        }).extend(tempoActions());

        const { receipt } = await walletClient.token.transferSync({
          to: merchantAddress,
          amount: amountParsed,
          memo,
          token: merchantToken,
          feePayer: true,
        });

        return receipt.transactionHash;
      }

      // ── Swap + Transfer (atomic batch) ───────────────────────────
      setSubStep("quoting");

      const quoteAbi = [
        {
          type: "function",
          name: "quoteSwapExactAmountOut",
          inputs: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountOut", type: "uint128" },
          ],
          outputs: [{ name: "amountIn", type: "uint128" }],
          stateMutability: "view",
        },
      ] as const;

      const swapAbi = [
        {
          type: "function",
          name: "swapExactAmountOut",
          inputs: [
            { name: "tokenIn", type: "address" },
            { name: "tokenOut", type: "address" },
            { name: "amountOut", type: "uint128" },
            { name: "maxAmountIn", type: "uint128" },
          ],
          outputs: [{ name: "amountIn", type: "uint128" }],
          stateMutability: "nonpayable",
        },
      ] as const;

      const slippageFactor = BigInt(Math.floor((1 + maxSlippage) * 10000));

      // The DEX precompile handles routing through the quote token tree internally
      const sellQuote = (await publicClient.readContract({
        address: STABLECOIN_DEX,
        abi: quoteAbi,
        functionName: "quoteSwapExactAmountOut",
        args: [payerToken, merchantToken, amountParsed],
      })) as bigint;

      const maxAmountIn = (sellQuote * slippageFactor) / 10000n;

      setSubStep("building");

      // Build atomic batch: approve + swap + transferWithMemo
      const calls = [
        // 1. Approve DEX to spend payer's token
        {
          to: payerToken,
          data: encodeFunctionData({
            abi: Abis.tip20,
            functionName: "approve",
            args: [STABLECOIN_DEX, maxAmountIn],
          }),
        },
        // 2. Swap payer token -> merchant token (exact output)
        {
          to: STABLECOIN_DEX,
          data: encodeFunctionData({
            abi: swapAbi,
            functionName: "swapExactAmountOut",
            args: [payerToken, merchantToken, amountParsed, maxAmountIn],
          }),
        },
        // 3. Transfer exact amount to merchant with memo
        {
          to: merchantToken,
          data: encodeFunctionData({
            abi: Abis.tip20,
            functionName: "transferWithMemo",
            args: [merchantAddress, amountParsed, memo],
          }),
        },
      ];

      // Get gas estimate, fee data, and nonce
      const [gasEstimate, feeData, nonce] = await Promise.all([
        publicClient.estimateGas({
          account: wallet.address as Address,
          to: calls[0].to,
          data: calls[0].data,
        }),
        publicClient.estimateFeesPerGas(),
        publicClient.getTransactionCount({
          address: wallet.address as Address,
        }),
      ]);

      // Build Tempo transaction envelope
      const envelope = TransactionEnvelopeTempo.from({
        chainId: tempoModerato.id,
        calls,
        nonce: BigInt(nonce),
        gas: gasEstimate * 3n, // Buffer for multi-call batch
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        feeToken: payerToken, // Pay fee in payer's token
      });

      // Sign
      setSubStep("signing");

      const signPayload = TransactionEnvelopeTempo.getSignPayload(envelope);
      const rawSignature = await provider.request({
        method: "secp256k1_sign",
        params: [signPayload],
      });

      const signature = parseSignature(rawSignature);

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

      // Broadcast
      setSubStep("broadcasting");

      const response = await fetch(TEMPO_RPC, {
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
      queryClient.invalidateQueries({ queryKey: ["paymentStatus"] });
    },
    onError: () => {
      setSubStep("error");
    },
  });

  const result: SwapPayResult = {
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

  return {
    pay: mutation.mutateAsync,
    result,
    reset,
  };
}

// Parse secp256k1 signature from Privy format
function parseSignature(sig: Hex): { r: Hex; s: Hex; yParity: 0 | 1 } {
  const sigHex = sig.slice(2);
  const r = `0x${sigHex.slice(0, 64)}` as Hex;
  const s = `0x${sigHex.slice(64, 128)}` as Hex;
  const v = parseInt(sigHex.slice(128, 130), 16);
  const yParity = (v === 27 || v === 0 ? 0 : 1) as 0 | 1;
  return { r, s, yParity };
}
