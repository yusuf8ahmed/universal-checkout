import { NextRequest, NextResponse } from "next/server";
import { formatUnits } from "viem";

const TEMPO_EXPLORER_API = "https://explore.tempo.xyz/api";
const TEMPO_RPC = "https://rpc.moderato.tempo.xyz";

/**
 * POST /api/verify-payment
 *
 * Checks if a payment matching a given memo has been received by the merchant.
 * Searches recent transactions on the merchant's address for a TransferWithMemo
 * event matching the memo bytes32.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { merchantAddress, tokenAddress, memo } = body;

    if (!merchantAddress || !memo) {
      return NextResponse.json(
        { error: "merchantAddress and memo are required" },
        { status: 400 }
      );
    }

    // Fetch recent transactions for the merchant
    const url = new URL(`${TEMPO_EXPLORER_API}/address/${merchantAddress}`);
    url.searchParams.set("include", "all");
    url.searchParams.set("limit", "50");
    url.searchParams.set("offset", "0");

    const response = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { paid: false, error: "Failed to fetch transactions" },
        { status: 200 }
      );
    }

    const data = (await response.json()) as {
      transactions?: Array<{
        hash: string;
        from: string;
        to: string;
        input: string;
        value: string;
        blockNumber: string;
        type?: string;
        [key: string]: unknown;
      }>;
    };

    if (!data.transactions) {
      return NextResponse.json({ paid: false });
    }

    // Normalize the memo for comparison (remove 0x, lowercase)
    const normalizedMemo = memo.toLowerCase().replace("0x", "");

    // Search for a transferWithMemo matching our memo
    // transferWithMemo signature: 0x95777d59
    for (const tx of data.transactions) {
      // Only check transactions TO the token contract (TIP-20 calls)
      if (
        tokenAddress &&
        tx.to.toLowerCase() !== tokenAddress.toLowerCase()
      ) {
        continue;
      }

      if (tx.input && tx.input.startsWith("0x95777d59")) {
        try {
          // Parse transferWithMemo(address to, uint256 amount, bytes32 memo)
          const inputData = tx.input.slice(10); // Remove function selector
          const toAddress = "0x" + inputData.slice(24, 64); // address (padded)
          const amountHex = "0x" + inputData.slice(64, 128);
          const txMemo = inputData.slice(128, 192).toLowerCase();

          // Check if memo matches and recipient is the merchant
          if (
            txMemo === normalizedMemo &&
            toAddress.toLowerCase() === merchantAddress.toLowerCase()
          ) {
            // Fetch timestamp
            let timestamp = 0;
            try {
              const blockResponse = await fetch(TEMPO_RPC, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "eth_getBlockByNumber",
                  params: [tx.blockNumber, false],
                  id: 1,
                }),
              });
              const blockData = (await blockResponse.json()) as {
                result?: { timestamp: string };
              };
              if (blockData.result?.timestamp) {
                timestamp = parseInt(blockData.result.timestamp, 16);
              }
            } catch {
              // timestamp stays 0
            }

            const amount = formatUnits(BigInt(amountHex), 6);

            return NextResponse.json({
              paid: true,
              txHash: tx.hash,
              from: tx.from,
              amount,
              token: tx.to,
              timestamp,
            });
          }
        } catch (err) {
          console.error("Error parsing tx:", err);
          continue;
        }
      }

      // Also check Tempo 0x76 batch transactions that may contain transferWithMemo
      if (tx.type === "0x76") {
        try {
          // Fetch raw transaction to decode batch calls
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
          const rawTxData = (await rawTxResponse.json()) as {
            result?: string;
          };

          if (rawTxData.result) {
            const { TransactionEnvelopeTempo } = await import("tempo.ts/ox");
            const decoded = TransactionEnvelopeTempo.deserialize(
              rawTxData.result as `0x76${string}`
            );

            if (decoded.calls) {
              for (const call of decoded.calls) {
                if (call.data && call.data.startsWith("0x95777d59")) {
                  const inputData = call.data.slice(10);
                  const toAddress = "0x" + inputData.slice(24, 64);
                  const amountHex = "0x" + inputData.slice(64, 128);
                  const txMemo = inputData.slice(128, 192).toLowerCase();

                  if (
                    txMemo === normalizedMemo &&
                    toAddress.toLowerCase() === merchantAddress.toLowerCase()
                  ) {
                    const amount = formatUnits(BigInt(amountHex), 6);
                    return NextResponse.json({
                      paid: true,
                      txHash: tx.hash,
                      from: tx.from,
                      amount,
                      token: call.to || tokenAddress,
                      timestamp: 0,
                    });
                  }
                }
              }
            }
          }
        } catch {
          continue;
        }
      }
    }

    return NextResponse.json({ paid: false });
  } catch (error) {
    console.error("Error in /api/verify-payment:", error);
    return NextResponse.json(
      { error: "Internal server error", paid: false },
      { status: 500 }
    );
  }
}
