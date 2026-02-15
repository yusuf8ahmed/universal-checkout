"use client";

import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { TOKEN_BY_ADDRESS, type TokenInfo } from "@/constants";

// transferWithMemo(address to, uint256 amount, bytes32 memo)
const TRANSFER_WITH_MEMO_SELECTOR = "0x95777d59";

export interface RecentPayment {
  /** Transaction hash */
  txHash: string;
  /** Address that sent the payment */
  from: string;
  /** Recipient address (decoded from transferWithMemo `to` arg) */
  merchant: string;
  /** Human-readable amount (e.g. "50.00") */
  amount: string;
  /** Token contract address */
  token: string;
  /** Resolved token metadata, if known */
  tokenInfo?: TokenInfo;
  /** Invoice reference decoded from the on-chain memo */
  reference: string;
  /** Raw bytes32 memo hex */
  memo: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Decode a right-padded bytes32 hex value back to a UTF-8 string. */
function parseHexToString(hex: string): string | undefined {
  try {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }

    // Find first non-zero byte
    let start = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) {
        start = i;
        break;
      }
    }

    // Find first zero byte after content
    let end = bytes.length;
    for (let i = start; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        end = i;
        break;
      }
    }

    if (start === end) return undefined;

    const decoder = new TextDecoder();
    const result = decoder.decode(bytes.slice(start, end)).trim();
    return result.length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Parse the calldata of a transferWithMemo call.
 * Layout after the 4-byte selector:
 *   [0..64]   address to   (left-padded)
 *   [64..128] uint256 amount
 *   [128..192] bytes32 memo
 */
function parseTransferWithMemo(
  calldata: string,
): { to: string; amount: bigint; memo: string; reference: string | undefined } | null {
  try {
    const data = calldata.slice(10); // strip "0x" + 4-byte selector
    const to = "0x" + data.slice(24, 64);
    const amountHex = "0x" + data.slice(64, 128);
    const memoHex = "0x" + data.slice(128, 192);
    const reference = parseHexToString(memoHex);
    return { to, amount: BigInt(amountHex), memo: memoHex, reference };
  } catch {
    return null;
  }
}

// ── Fetcher ──────────────────────────────────────────────────────────────

interface RawTx {
  hash: string;
  from: string;
  to: string;
  input: string;
  value: string;
  blockNumber: string;
  timestamp: number;
  type?: string;
  calls?: Array<{ to: string; value?: string; data?: string }>;
}

async function fetchRecentPayments(address: string): Promise<RecentPayment[]> {
  const url = new URL("/api/transactions", window.location.origin);
  url.searchParams.set("address", address);
  url.searchParams.set("limit", "5");
  url.searchParams.set("offset", "0");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    transactions?: RawTx[];
    error?: string | null;
  };

  if (data.error) throw new Error(data.error);

  const payments: RecentPayment[] = [];

  for (const tx of data.transactions ?? []) {
    try {
      // Case 1: Direct transferWithMemo transaction
      if (tx.input?.startsWith(TRANSFER_WITH_MEMO_SELECTOR)) {
        const parsed = parseTransferWithMemo(tx.input);
        if (parsed?.reference) {
          const tokenAddr = tx.to.toLowerCase();
          payments.push({
            txHash: tx.hash,
            from: tx.from,
            merchant: parsed.to,
            amount: formatUnits(parsed.amount, 6),
            token: tx.to,
            tokenInfo: TOKEN_BY_ADDRESS[tokenAddr],
            reference: parsed.reference,
            memo: parsed.memo,
            timestamp: tx.timestamp || 0,
          });
        }
      }

      // Case 2: Tempo 0x76 batch transaction containing transferWithMemo
      if (tx.type === "0x76" && tx.calls) {
        for (const call of tx.calls) {
          if (call.data?.startsWith(TRANSFER_WITH_MEMO_SELECTOR)) {
            const parsed = parseTransferWithMemo(call.data);
            if (parsed?.reference) {
              const tokenAddr = (call.to ?? "").toLowerCase();
              payments.push({
                txHash: tx.hash,
                from: tx.from,
                merchant: parsed.to,
                amount: formatUnits(parsed.amount, 6),
                token: call.to ?? "",
                tokenInfo: TOKEN_BY_ADDRESS[tokenAddr],
                reference: parsed.reference,
                memo: parsed.memo,
                timestamp: tx.timestamp || 0,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error processing transaction for payments:", err);
    }
  }

  return payments;
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useRecentPayments(walletAddress: string | undefined) {
  const {
    data: payments = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["recentPayments", walletAddress],
    queryFn: () => fetchRecentPayments(walletAddress!),
    enabled: !!walletAddress,
    refetchInterval: 10_000,
  });

  return {
    payments,
    loading,
    error: queryError instanceof Error ? queryError.message : null,
  };
}
