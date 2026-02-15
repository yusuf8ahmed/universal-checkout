import { NextRequest, NextResponse } from "next/server";
import { TransactionEnvelopeTempo } from "tempo.ts/ox";

const TEMPO_EXPLORER_API = "https://explore.tempo.xyz/api";
const TEMPO_RPC = "https://rpc.moderato.tempo.xyz";

interface BlockInfo {
  result?: {
    timestamp: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");
    const limit = request.nextUrl.searchParams.get("limit") || "10";
    const offset = request.nextUrl.searchParams.get("offset") || "0";

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    // Call Tempo Explorer API from server to avoid CORS
    const url = new URL(`${TEMPO_EXPLORER_API}/address/${address}`);
    url.searchParams.set("include", "all");
    url.searchParams.set("limit", limit);
    url.searchParams.set("offset", offset);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch transactions: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      transactions?: Array<{
        hash: string;
        from: string;
        to: string;
        blockNumber: string;
        input: string;
        value: string;
        [key: string]: unknown;
      }>;
      total?: number;
      offset?: number;
      limit?: number;
      hasMore?: boolean;
      error?: string | null;
    };

    // Fetch timestamps and decode Tempo transactions
    if (data.transactions && Array.isArray(data.transactions)) {
      const transactionsWithDetails = await Promise.all(
        data.transactions.map(async (tx) => {
          try {
            // Fetch block timestamp
            const blockResponse = await fetch(TEMPO_RPC, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                method: "eth_getBlockByNumber",
                params: [tx.blockNumber, false],
                id: 1,
              }),
            });

            const blockData = (await blockResponse.json()) as BlockInfo;
            const timestamp = blockData.result?.timestamp
              ? parseInt(blockData.result.timestamp, 16)
              : 0;

            // For Tempo 0x76 transactions, fetch raw tx and decode calls
            let calls: Array<{ to: string; value?: string; data?: string }> | undefined;
            if (tx.type === "0x76") {
              try {
                const rawTxResponse = await fetch(TEMPO_RPC, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "eth_getRawTransactionByHash",
                    params: [tx.hash],
                    id: 1,
                  }),
                });
                const rawTxData = await rawTxResponse.json() as { result?: string };
                if (rawTxData.result) {
                  const decoded = TransactionEnvelopeTempo.deserialize(rawTxData.result as `0x76${string}`);
                  calls = decoded.calls?.map(c => ({
                    to: c.to || "",
                    value: c.value?.toString(),
                    data: c.data,
                  }));
                }
              } catch (err) {
                console.error(`Error decoding Tempo tx ${tx.hash}:`, err);
              }
            }

            return {
              ...tx,
              timestamp,
              calls,
            };
          } catch (err) {
            console.error(`Error fetching details for ${tx.hash}:`, err);
            return {
              ...tx,
              timestamp: 0,
            };
          }
        })
      );

      return NextResponse.json({
        ...data,
        transactions: transactionsWithDetails,
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in /api/transactions:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}
