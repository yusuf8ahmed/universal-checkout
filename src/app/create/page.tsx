"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { type Address } from "viem";
import { TOKEN_LIST, alphaUsd } from "@/constants";
import { TokenSelector } from "@/components/TokenSelector";
import {
  type Invoice,
  buildPayUrl,
  buildReceiptUrl,
  invoiceMemo,
  truncateAddress,
} from "@/lib/invoice";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export default function CreatePage() {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address || "";

  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<string>(alphaUsd);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCreate = () => {
    if (!amount || !reference || !walletAddress) return;

    const invoice: Invoice = {
      merchant: walletAddress as Address,
      amount,
      token: token as Address,
      description: description || "Payment",
      reference,
      merchantName: merchantName || undefined,
    };

    setCreatedInvoice(invoice);
  };

  const getFullUrl = (path: string) => {
    if (typeof window === "undefined") return path;
    return `${window.location.origin}${path}`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedToken = TOKEN_LIST.find(
    (t) => t.address.toLowerCase() === token.toLowerCase()
  );

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[10px] mb-1 uppercase tracking-wider">
                Universal Checkout
              </h1>
              <p className="text-[10px] opacity-50">Create Payment Link</p>
            </div>
            <Link
              href="/"
              className="text-[10px] opacity-30 hover:opacity-50"
            >
              &larr; Back
            </Link>
          </div>
        </motion.div>

        {!authenticated ? (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mb-8"
          >
            <p className="opacity-70 mb-4">
              Log in to create payment links.
            </p>
            <motion.button
              whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.5)" }}
              whileTap={{ scale: 0.99 }}
              onClick={login}
              className="border border-white/20 px-4 py-2 w-full text-left"
            >
              Log in with Email or Phone
            </motion.button>
          </motion.div>
        ) : !createdInvoice ? (
          /* Payment Form */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
                Merchant
              </label>
              <p className="opacity-70 py-2">
                {truncateAddress(walletAddress)}
              </p>
            </motion.div>

            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
                Merchant Name (optional)
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Your business name"
                className="w-full"
              />
            </motion.div>

            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
                Reference ID *
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="INV-001"
                className="w-full"
              />
            </motion.div>

            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Web design services"
                className="w-full"
              />
            </motion.div>

            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <TokenSelector
                value={token}
                onChange={setToken}
                label="Receive Token"
              />
            </motion.div>

            <motion.div variants={fadeInUp} transition={{ duration: 0.25 }}>
              <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
                Amount ({selectedToken?.symbol || "USD"}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50.00"
                className="w-full"
              />
            </motion.div>

            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.25 }}
              className="border-t border-white/20 pt-4 mt-6"
            >
              <motion.button
                whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.7)" }}
                whileTap={{ scale: 0.99 }}
                onClick={handleCreate}
                disabled={!amount || !reference}
                className={`border px-4 py-3 w-full ${
                  amount && reference
                    ? "border-white/40 opacity-90"
                    : "border-white/10 opacity-30 cursor-not-allowed"
                }`}
              >
                Generate Payment Link
              </motion.button>
            </motion.div>
          </motion.div>
        ) : (
          /* Created Payment View */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-6"
          >
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border border-white/20 p-4"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-3">
                Payment Created
              </p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="opacity-50">Reference</span>
                  <span className="opacity-90">{createdInvoice.reference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Amount</span>
                  <span className="opacity-90">
                    {createdInvoice.amount} {selectedToken?.symbol}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-50">Description</span>
                  <span className="opacity-90">
                    {createdInvoice.description}
                  </span>
                </div>
                {createdInvoice.merchantName && (
                  <div className="flex justify-between">
                    <span className="opacity-50">Merchant</span>
                    <span className="opacity-90">
                      {createdInvoice.merchantName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="opacity-50">Memo (on-chain)</span>
                  <span className="opacity-70 text-[9px] break-all max-w-[200px] text-right">
                    {invoiceMemo(createdInvoice.reference).slice(0, 20)}...
                  </span>
                </div>
              </div>
            </motion.div>

            {/* QR Code */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center border border-white/20 p-6"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-4">
                Scan to Pay
              </p>
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="bg-white p-3"
              >
                <QRCodeSVG
                  value={getFullUrl(buildPayUrl(createdInvoice))}
                  size={180}
                  level="M"
                />
              </motion.div>
            </motion.div>

            {/* Payment Link */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border border-white/20 p-4"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-2">
                Payment Link
              </p>
              <p className="text-[10px] opacity-70 break-all mb-3">
                {getFullUrl(buildPayUrl(createdInvoice))}
              </p>
              <motion.button
                whileHover={{ borderColor: "rgba(255,255,255,0.5)" }}
                whileTap={{ scale: 0.99 }}
                onClick={() =>
                  handleCopy(getFullUrl(buildPayUrl(createdInvoice)))
                }
                className="border border-white/20 px-3 py-1.5 text-[10px] w-full"
              >
                {copied ? "Copied!" : "Copy Link"}
              </motion.button>
            </motion.div>

            {/* Receipt Link */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border border-white/20 p-4"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-2">
                Receipt Page
              </p>
              <Link
                href={buildReceiptUrl(createdInvoice)}
                className="text-[10px] opacity-70 hover:opacity-90 underline"
              >
                View Receipt &rarr;
              </Link>
            </motion.div>

            {/* Create Another */}
            <motion.button
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              whileHover={{ borderColor: "rgba(255,255,255,0.5)" }}
              whileTap={{ scale: 0.99 }}
              onClick={() => {
                setCreatedInvoice(null);
                setAmount("");
                setReference("");
                setDescription("");
                setMerchantName("");
              }}
              className="border border-white/20 px-4 py-2 text-[10px] w-full opacity-50"
            >
              Create Another Payment
            </motion.button>
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
