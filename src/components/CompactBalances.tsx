"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, useEffect } from "react";
import { truncateAddress } from "@/lib/invoice";
import { TEMPO_EXPLORER } from "@/constants";
import type { TokenBalance } from "@/hooks/useMultiTokenBalance";

interface CompactBalancesProps {
  balances: TokenBalance[];
  loading: boolean;
  walletAddress: string;
}

export function CompactBalances({
  balances,
  loading,
  walletAddress,
}: CompactBalancesProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (balances.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % balances.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [balances.length]);

  const active = balances[activeIndex];

  return (
    <div className="flex items-center justify-between py-1.5 text-[11px]">
      {/* Left: clickable address → explorer */}
      {walletAddress && (
        <motion.a
          href={`${TEMPO_EXPLORER}/address/${walletAddress}`}
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ opacity: 0.6 }}
          className="opacity-30 tabular-nums shrink-0 mr-3"
        >
          {truncateAddress(walletAddress)}
        </motion.a>
      )}

      {/* Right: cycling balance */}
      <div className="flex items-center gap-0 min-w-0">
        {loading ? (
          <motion.span
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            className="opacity-30"
          >
            —
          </motion.span>
        ) : balances.length === 0 ? (
          <span className="opacity-30">0.00</span>
        ) : (
          <div className="relative h-[14px] min-w-[80px]">
            <AnimatePresence mode="wait">
              {active && (
                <motion.span
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="absolute inset-0 flex items-center justify-end gap-1"
                >
                  <span className="tabular-nums opacity-80">
                    {active.display}
                  </span>
                  <span className="opacity-40">{active.token.symbol}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
