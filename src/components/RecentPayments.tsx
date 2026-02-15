"use client";

import { motion, AnimatePresence } from "motion/react";
import type { RecentPayment } from "@/hooks/useRecentPayments";
import { TEMPO_EXPLORER } from "@/constants";

interface RecentPaymentsProps {
  payments: RecentPayment[];
}

function timeAgo(ts: number): string {
  if (!ts) return "just now";
  // ts may be unix seconds (from chain) or milliseconds
  const msTs = ts < 1e12 ? ts * 1000 : ts;
  const s = Math.floor((Date.now() - msTs) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(msTs).toLocaleDateString();
}

export function RecentPayments({ payments }: RecentPaymentsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="border-t border-white/20 pt-6"
    >
      <p className="text-[10px] opacity-50 uppercase tracking-wider mb-3">
        Recent Payments
      </p>

      {payments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="border border-dashed border-white/10 py-8 px-4 flex flex-col items-center gap-2"
        >
          <span className="text-[11px] opacity-30">No payments yet</span>
          <span className="text-[9px] opacity-20 text-center max-w-[220px]">
            Payments will appear here once they are confirmed on-chain.
          </span>
        </motion.div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {payments.map((p, i) => (
              <PaymentRow
                key={`${p.txHash}-${p.reference}`}
                payment={p}
                index={i}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

/* ── Single Row ─────────────────────────────────────────────────────── */

function PaymentRow({
  payment,
  index,
}: {
  payment: RecentPayment;
  index: number;
}) {
  const symbol = payment.tokenInfo?.symbol ?? "USD";
  const explorerUrl = `${TEMPO_EXPLORER}/tx/${payment.txHash}`;

  const handleClick = () => {
    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 6 }}
      transition={{ duration: 0.2, delay: index * 0.03 }}
      onClick={handleClick}
      className="border border-white/10 px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:border-white/25 transition-colors"
    >
      {/* Left: icon column */}
      <div className="shrink-0 w-7 h-7 border border-white/15 flex items-center justify-center text-[9px] opacity-50">
        {symbol.charAt(0)}
      </div>

      {/* Middle: details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] opacity-90 truncate">
            {payment.reference}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] opacity-30">
            {timeAgo(payment.timestamp)}
          </span>
        </div>
      </div>

      {/* Right: amount + confirmed badge */}
      <div className="shrink-0 text-right flex items-center gap-2">
        <div>
          <span className="text-[11px] opacity-80 tabular-nums">
            {parseFloat(payment.amount).toFixed(2)}
          </span>
          <span className="text-[9px] opacity-40 ml-1">{symbol}</span>
        </div>

        <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 border border-green-500/25 text-green-400/70">
          Paid
        </span>
      </div>
    </motion.div>
  );
}
