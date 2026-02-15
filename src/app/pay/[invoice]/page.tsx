"use client";

import { useParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useMemo, useState } from "react";
import { type Address, createPublicClient, defineChain, http, parseUnits, formatUnits } from "viem";
import {
  decodeInvoice,
  getInvoiceToken,
  invoiceMemo,
  truncateAddress,
  buildReceiptUrl,
} from "@/lib/invoice";
import {
  TOKEN_BY_ADDRESS,
  TEMPO_RPC,
  TEMPO_EXPLORER,
  alphaUsd,
} from "@/constants";
import { TokenSelector } from "@/components/TokenSelector";
import { StatusBadge } from "@/components/StatusBadge";
import { useMultiTokenBalance } from "@/hooks/useMultiTokenBalance";
import { useSwapAndPay } from "@/hooks/useSwapAndPay";
import Link from "next/link";
import { motion } from "motion/react";

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const tempoModerato = defineChain({
  id: 42431,
  name: "Tempo Moderato",
  nativeCurrency: { name: "AlphaUSD", symbol: "aUSD", decimals: 6 },
  rpcUrls: { default: { http: [TEMPO_RPC] } },
  feeToken: alphaUsd,
});

const publicClient = createPublicClient({
  chain: tempoModerato,
  transport: http(TEMPO_RPC),
});

// DEX precompile (Tempo enshrined stablecoin exchange)
const STABLECOIN_DEX = "0xdec0000000000000000000000000000000000000" as Address;

export default function PayPage() {
  const params = useParams();
  const encodedInvoice = params.invoice as string;
  const invoice = useMemo(
    () => decodeInvoice(decodeURIComponent(encodedInvoice)),
    [encodedInvoice]
  );
  const invoiceToken = invoice ? getInvoiceToken(invoice) : undefined;

  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address || "";

  const { balances, loading: balancesLoading } =
    useMultiTokenBalance(walletAddress);
  const { pay, result, reset } = useSwapAndPay();

  const [selectedToken, setSelectedToken] = useState<string>("");
  const [quote, setQuote] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // Default to merchant's preferred token
  useEffect(() => {
    if (invoice && !selectedToken) {
      setSelectedToken(invoice.token);
    }
  }, [invoice, selectedToken]);

  // Fetch swap quote when selected token differs from merchant token
  useEffect(() => {
    if (!invoice || !selectedToken) return;

    const isSameToken =
      selectedToken.toLowerCase() === invoice.token.toLowerCase();

    if (isSameToken) {
      setQuote(null);
      return;
    }

    let cancelled = false;

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

    const fetchQuote = async () => {
      setQuoteLoading(true);
      try {
        const amountOut = parseUnits(invoice.amount, 6);

        // The DEX precompile handles routing through the quote token tree internally
        const amountIn = (await publicClient.readContract({
          address: STABLECOIN_DEX,
          abi: quoteAbi,
          functionName: "quoteSwapExactAmountOut",
          args: [
            selectedToken as Address,
            invoice.token as Address,
            amountOut,
          ],
        })) as bigint;

        if (!cancelled) {
          setQuote(formatUnits(amountIn, 6));
        }
      } catch (err) {
        console.error("Quote error:", err);
        if (!cancelled) {
          setQuote(null);
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false);
        }
      }
    };

    fetchQuote();

    return () => {
      cancelled = true;
    };
  }, [invoice, selectedToken]);

  if (!invoice) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="min-h-screen p-4 md:p-8"
      >
        <div className="max-w-lg mx-auto">
          <div className="mb-8 border-b border-white/20 pb-4">
            <h1 className="text-[10px] mb-1 uppercase tracking-wider">
              Universal Checkout
            </h1>
            <p className="text-[10px] opacity-50">Invalid Payment Link</p>
          </div>
          <p className="opacity-70">
            This payment link is invalid or has been corrupted.
          </p>
          <Link
            href="/"
            className="block mt-4 text-[10px] opacity-50 hover:opacity-70"
          >
            &larr; Go Home
          </Link>
        </div>
      </motion.div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{ color: "var(--text-tertiary)" }}
        >
          Loading...
        </motion.p>
      </div>
    );
  }

  const isSameToken =
    selectedToken.toLowerCase() === invoice.token.toLowerCase();
  const selectedTokenInfo = TOKEN_BY_ADDRESS[selectedToken.toLowerCase()];
  const payerBalance = balances.find(
    (b) => b.token.address.toLowerCase() === selectedToken.toLowerCase()
  );
  const amountNeeded = isSameToken
    ? invoice.amount
    : quote || invoice.amount;
  const hasEnough =
    payerBalance &&
    parseFloat(payerBalance.formatted) >= parseFloat(amountNeeded);

  const handlePay = () => {
    if (!invoice || !selectedToken) return;

    pay({
      merchantAddress: invoice.merchant,
      amount: invoice.amount,
      merchantToken: invoice.token as Address,
      payerToken: selectedToken as Address,
      reference: invoice.reference,
    });
  };

  const statusLabels: Record<string, string> = {
    idle: "Pay Now",
    quoting: "Getting quote...",
    building: "Preparing transaction...",
    signing: "Sign in wallet...",
    broadcasting: "Broadcasting...",
    success: "Payment Sent!",
    error: "Try Again",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen p-4 md:p-8"
    >
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.35 }}
          className="mb-8 border-b border-white/20 pb-4"
        >
          <h1 className="text-[10px] mb-1 uppercase tracking-wider">
            Universal Checkout
          </h1>
          <p className="text-[10px] opacity-50">Payment Request</p>
        </motion.div>

        {/* Invoice Details */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.35, delay: 0.05 }}
          className="border border-white/20 p-4 mb-6"
        >
          <p className="text-[10px] opacity-50 uppercase tracking-wider mb-3">
            Invoice Details
          </p>
          <div className="space-y-2">
            {invoice.merchantName && (
              <div className="flex justify-between">
                <span className="opacity-50">From</span>
                <span className="opacity-90">{invoice.merchantName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="opacity-50">To</span>
              <span className="opacity-70">
                {truncateAddress(invoice.merchant)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-50">Reference</span>
              <span className="opacity-90">{invoice.reference}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-50">Description</span>
              <span className="opacity-90">{invoice.description}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
              <span className="opacity-50">Amount Due</span>
              <span className="opacity-90 text-[13px]">
                {invoice.amount} {invoiceToken?.symbol || "USD"}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Auth Gate */}
        {!authenticated ? (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mb-6"
          >
            <p className="opacity-70 mb-4 text-[11px]">
              Log in to pay this invoice. You can pay with any supported
              stablecoin.
            </p>
            <motion.button
              whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.5)" }}
              whileTap={{ scale: 0.99 }}
              onClick={login}
              className="border border-white/20 px-4 py-3 w-full"
            >
              Log in to Pay
            </motion.button>
          </motion.div>
        ) : result.status === "success" ? (
          /* Success State */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border border-green-500/20 p-4"
            >
              <StatusBadge status="paid" />
              <p className="opacity-70 mt-3 text-[11px]">
                Payment submitted successfully.
              </p>
              {result.txHash && (
                <div className="mt-3">
                  <p className="text-[10px] opacity-50 mb-1">
                    Transaction Hash
                  </p>
                  <a
                    href={`${TEMPO_EXPLORER}/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] opacity-70 hover:opacity-90 underline break-all"
                  >
                    {result.txHash}
                  </a>
                </div>
              )}
            </motion.div>
            <motion.div variants={fadeInUp} transition={{ duration: 0.3 }}>
              <Link
                href={buildReceiptUrl(invoice)}
                className="border border-white/20 px-4 py-2 block text-center text-[10px] hover:border-white/50"
              >
                View Receipt &rarr;
              </Link>
            </motion.div>
          </motion.div>
        ) : (
          /* Payment Form */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            {/* Token Selector */}
            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-2">
                Pay With
              </p>
              <TokenSelector
                value={selectedToken}
                onChange={(addr) => {
                  setSelectedToken(addr);
                  setQuote(null);
                  reset();
                }}
                label=""
              />
            </motion.div>

            {/* Balances */}
            {!balancesLoading && walletAddress && (
              <motion.div
                variants={fadeInUp}
                transition={{ duration: 0.25 }}
                className="border border-white/10 p-3"
              >
                <p className="text-[10px] opacity-40 mb-2">Your Balances</p>
                <div className="grid grid-cols-4 gap-2">
                  {balances.map((b) => (
                    <motion.div
                      key={b.token.address}
                      animate={{
                        opacity:
                          b.token.address.toLowerCase() ===
                            selectedToken.toLowerCase()
                            ? 0.9
                            : 0.4,
                      }}
                      transition={{ duration: 0.2 }}
                      className="text-center"
                    >
                      <p className="text-[10px]">{b.token.symbol}</p>
                      <p className="text-[11px]">{b.display}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Swap Quote */}
            {!isSameToken && selectedToken && (
              <motion.div
                variants={fadeInUp}
                transition={{ duration: 0.25 }}
                className="border border-white/10 p-3"
              >
                <p className="text-[10px] opacity-50 uppercase tracking-wider mb-2">
                  Auto FX Quote
                </p>
                {quoteLoading ? (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
                  >
                    Fetching exchange rate...
                  </motion.p>
                ) : quote ? (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="opacity-50">You pay</span>
                      <span className="opacity-90">
                        ~{parseFloat(quote).toFixed(2)}{" "}
                        {selectedTokenInfo?.symbol}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-50">Merchant receives</span>
                      <span className="opacity-90">
                        {invoice.amount} {invoiceToken?.symbol}
                      </span>
                    </div>
                    <p className="text-[9px] opacity-30 mt-1">
                      Includes 0.5% slippage tolerance. Routed via Tempo DEX.
                    </p>
                  </div>
                ) : (
                  <p className="opacity-40 text-[10px]">
                    No liquidity available for this pair.
                  </p>
                )}
              </motion.div>
            )}

            {/* Gasless Notice */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.25 }}
              className="border border-white/10 p-3"
            >
              <p className="text-[10px] opacity-40">
                {isSameToken
                  ? "This transaction is gasless — fees are sponsored."
                  : "Atomic batch: approve + swap + transfer in one transaction. Fees paid in your token."}
              </p>
            </motion.div>

            {/* Error */}
            {result.error && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="border border-red-500/20 p-3"
              >
                <p className="text-[10px] text-red-400">{result.error}</p>
              </motion.div>
            )}

            {/* Pay Button */}
            <motion.button
              variants={fadeInUp}
              transition={{ duration: 0.25 }}
              whileHover={
                (result.status === "idle" || result.status === "error") &&
                  (isSameToken || quote) &&
                  hasEnough
                  ? { scale: 1.01, borderColor: "rgba(255,255,255,0.7)" }
                  : {}
              }
              whileTap={
                (result.status === "idle" || result.status === "error") &&
                  (isSameToken || quote) &&
                  hasEnough
                  ? { scale: 0.99 }
                  : {}
              }
              onClick={handlePay}
              disabled={
                result.status !== "idle" &&
                result.status !== "error" ||
                (!isSameToken && !quote) ||
                !hasEnough
              }
              className={`border px-4 py-3 w-full ${(result.status === "idle" || result.status === "error") &&
                  (isSameToken || quote) &&
                  hasEnough
                  ? "border-white/40 opacity-90"
                  : "border-white/10 opacity-30 cursor-not-allowed"
                }`}
            >
              {!hasEnough && (result.status === "idle" || result.status === "error")
                ? `Insufficient ${selectedTokenInfo?.symbol || "token"} balance`
                : statusLabels[result.status] || "Pay Now"}
            </motion.button>

            {/* Memo Info */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.25 }}
              className="text-[9px] opacity-30 text-center"
            >
              <p>
                On-chain memo: {invoiceMemo(invoice.reference).slice(0, 20)}...
              </p>
            </motion.div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="border-t border-white/20 pt-4 mt-8 text-[10px] opacity-30 text-center"
        >
          <p>Built on Tempo &middot; Gasless &middot; Any Stablecoin</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
