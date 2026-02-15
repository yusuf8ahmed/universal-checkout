import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";

interface TransactionData {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber: number;
  timestamp: number;
  type: "send" | "receive";
  amount: string;
  formattedTimestamp: string;
  memo?: string;
  token?: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

async function fetchTransactions(address: string): Promise<TransactionData[]> {
  const url = new URL("/api/transactions", window.location.origin);
  url.searchParams.set("address", address);
  url.searchParams.set("limit", "10");
  url.searchParams.set("offset", "0");

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch transactions: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    transactions?: Array<{
      hash: string;
      from: string;
      to: string;
      value: string;
      blockNumber: string;
      input: string;
      timestamp: number;
      type?: string;
      calls?: Array<{ to: string; value?: string; data?: string }>;
      [key: string]: unknown;
    }>;
    error?: string | null;
  };

  if (data.error) {
    throw new Error(data.error);
  }

  const parsedTxs: TransactionData[] = [];

  for (const tx of data.transactions || []) {
    try {
      const type =
        tx.from.toLowerCase() === address.toLowerCase() ? "send" : "receive";

      let amount = tx.value;
      let memo: string | undefined;

      // Handle Tempo 0x76 batch transactions with calls array
      if (tx.type === "0x76" && tx.calls && tx.calls.length > 0) {
        let totalAmount = 0n;
        for (const call of tx.calls) {
          if (call.data && call.data.startsWith("0xa9059cbb")) {
            const amountHex =
              "0x" + call.data.slice(10 + 64, 10 + 64 + 64);
            totalAmount += BigInt(amountHex);
          }
        }
        amount = "0x" + totalAmount.toString(16);
      }
      // Check for transferWithMemo (function signature: 0x95777d59)
      else if (tx.input && tx.input.startsWith("0x95777d59")) {
        try {
          const amountHex = "0x" + tx.input.slice(10 + 64, 10 + 64 + 64);
          amount = amountHex;

          const memoHex =
            "0x" + tx.input.slice(10 + 64 + 64, 10 + 64 + 64 + 64);
          memo = parseHexToString(memoHex);
        } catch (e) {
          console.error("Error parsing transferWithMemo:", e);
        }
      }
      // Check for basic transfer (function signature: 0xa9059cbb)
      else if (tx.input && tx.input.startsWith("0xa9059cbb")) {
        const amountHex = "0x" + tx.input.slice(10 + 64, 10 + 64 + 64);
        amount = amountHex;
      }

      const formattedAmount = formatUnits(BigInt(amount), 6);
      const blockNumber = parseInt(tx.blockNumber, 16);

      parsedTxs.push({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: amount,
        blockNumber,
        timestamp: tx.timestamp || 0,
        type,
        amount: parseFloat(formattedAmount).toFixed(2),
        formattedTimestamp: formatTimestamp(tx.timestamp || 0),
        memo,
      });
    } catch (err) {
      console.error("Error processing transaction:", err, tx);
    }
  }

  return parsedTxs;
}

export function useTransactionHistory(
  address: string | undefined,
  refreshTrigger?: string
) {
  const {
    data: transactions = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["transactionHistory", address, refreshTrigger],
    queryFn: () => fetchTransactions(address!),
    enabled: !!address,
    refetchInterval: 10_000,
  });

  return {
    transactions,
    loading,
    error: queryError instanceof Error ? queryError.message : null,
  };
}

function formatTimestamp(unixTimestamp: number): string {
  if (!unixTimestamp) return "Unknown";

  const date = new Date(unixTimestamp * 1000);
  const now = new Date();
  const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)}d ago`;

  return date.toLocaleDateString();
}

function parseHexToString(hex: string): string | undefined {
  try {
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.slice(i, i + 2), 16);
    }

    let start = 0;
    let end = bytes.length;

    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] !== 0) {
        start = i;
        break;
      }
    }

    for (let i = start; i < bytes.length; i++) {
      if (bytes[i] === 0) {
        end = i;
        break;
      }
    }

    if (start === end) {
      return undefined;
    }

    const decoder = new TextDecoder();
    const result = decoder.decode(bytes.slice(start, end)).trim();

    return result.length > 0 ? result : undefined;
  } catch (e) {
    console.error("Error parsing hex to string:", e);
    return undefined;
  }
}
