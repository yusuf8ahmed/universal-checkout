"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import {
  decodeInvoice,
  getInvoiceToken,
  invoiceMemo,
  truncateAddress,
  buildPayUrl,
} from "@/lib/invoice";
import { TOKEN_BY_ADDRESS, TEMPO_EXPLORER } from "@/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import Link from "next/link";
import { motion } from "motion/react";

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

export default function ReceiptPage() {
  const params = useParams();
  const encodedInvoice = params.invoice as string;
  const invoice = useMemo(
    () => decodeInvoice(decodeURIComponent(encodedInvoice)),
    [encodedInvoice]
  );
  const invoiceToken = invoice ? getInvoiceToken(invoice) : undefined;

  const { payment, loading } = usePaymentStatus(
    invoice?.merchant,
    invoice?.token,
    invoice?.reference,
    5000
  );

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
            <p className="text-[10px] opacity-50">Invalid Receipt</p>
          </div>
          <p className="opacity-70">This receipt link is invalid.</p>
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

  const memo = invoiceMemo(invoice.reference);
  const paymentToken = payment.token
    ? TOKEN_BY_ADDRESS[payment.token.toLowerCase()]
    : undefined;

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
              <p className="text-[10px] opacity-50">Receipt</p>
            </div>
            <Link
              href="/"
              className="text-[10px] opacity-30 hover:opacity-50"
            >
              &larr; Home
            </Link>
          </div>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Status */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.3 }}
            className="mb-6 flex items-center justify-between"
          >
            <p className="text-[10px] opacity-50 uppercase tracking-wider">
              Payment Status
            </p>
            {loading ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
                className="text-[10px]"
              >
                Checking...
              </motion.span>
            ) : (
              <StatusBadge status={payment.paid ? "paid" : "pending"} />
            )}
          </motion.div>

          {/* Invoice Details */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.3 }}
            className="border border-white/20 p-4 mb-6"
          >
            <p className="text-[10px] opacity-50 uppercase tracking-wider mb-3">
              Invoice
            </p>
            <div className="space-y-2">
              {invoice.merchantName && (
                <div className="flex justify-between">
                  <span className="opacity-50">Merchant</span>
                  <span className="opacity-90">{invoice.merchantName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="opacity-50">Merchant Address</span>
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
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="opacity-50">Amount</span>
                <span className="opacity-90 text-[13px]">
                  {invoice.amount} {invoiceToken?.symbol || "USD"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* On-Chain Proof */}
          {payment.paid && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="border border-green-500/20 p-4 mb-6"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-3">
                On-Chain Proof
              </p>
              <div className="space-y-2">
                {payment.from && (
                  <div className="flex justify-between">
                    <span className="opacity-50">Payer</span>
                    <span className="opacity-70">
                      {truncateAddress(payment.from)}
                    </span>
                  </div>
                )}
                {payment.amount && (
                  <div className="flex justify-between">
                    <span className="opacity-50">Amount Received</span>
                    <span className="opacity-90">
                      {parseFloat(payment.amount).toFixed(2)}{" "}
                      {paymentToken?.symbol || invoiceToken?.symbol || "USD"}
                    </span>
                  </div>
                )}
                {payment.timestamp && payment.timestamp > 0 && (
                  <div className="flex justify-between">
                    <span className="opacity-50">Timestamp</span>
                    <span className="opacity-70">
                      {new Date(payment.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
                {payment.txHash && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <p className="text-[10px] opacity-50 mb-1">
                      Transaction Hash
                    </p>
                    <a
                      href={`${TEMPO_EXPLORER}/tx/${payment.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] opacity-70 hover:opacity-90 underline break-all"
                    >
                      {payment.txHash}
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Memo */}
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.3 }}
            className="border border-white/10 p-4 mb-6"
          >
            <p className="text-[10px] opacity-50 uppercase tracking-wider mb-2">
              On-Chain Memo (bytes32)
            </p>
            <p className="text-[9px] opacity-40 break-all">{memo}</p>
          </motion.div>

          {/* Actions */}
          {!payment.paid && (
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
            >
              <Link
                href={buildPayUrl(invoice)}
                className="border border-white/20 px-4 py-2 block text-center hover:border-white/50 mb-4"
              >
                Pay This Invoice &rarr;
              </Link>
            </motion.div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="border-t border-white/20 pt-4 mt-4 text-[10px] opacity-30 text-center"
        >
          <p>
            Verified on-chain via TransferWithMemo &middot; Built on Tempo
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
