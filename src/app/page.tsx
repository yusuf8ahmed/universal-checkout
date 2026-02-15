"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useMultiTokenBalance } from "@/hooks/useMultiTokenBalance";
import { useRecentPayments } from "@/hooks/useRecentPayments";
import Link from "next/link";
import { CompactBalances } from "@/components/CompactBalances";
import { RecentPayments } from "@/components/RecentPayments";
import { motion } from "motion/react";

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

export default function Home() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const activeWallet =
    wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = activeWallet?.address || "";
  const { balances, loading } = useMultiTokenBalance(walletAddress);
  const { payments } = useRecentPayments(walletAddress || undefined);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen p-4 md:p-8"
    >
      <div className="max-w-lg mx-auto flex flex-col space-y-2">
        {/* Header */}
        <motion.div
          variants={fadeInUp}
          initial="initial"
          animate="animate"
          transition={{ duration: 0.35 }}
          className="border-b border-white/20 pb-4"
        >
          <h1 className="text-[10px] mb-1 uppercase tracking-wider">
            Universal Checkout
          </h1>
          <p className="text-[10px] opacity-50">
            Gasless stablecoin payments with auto FX.
          </p>
        </motion.div>

        {/* Auth */}
        {!authenticated ? (
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ duration: 0.35, delay: 0.1 }}
          >
            <p className="opacity-70 mb-4">
              Create shareable payment links. Accept any stablecoin. No gas
              required.
            </p>
            <div className="border-t border-white/20 pt-6 mt-6">
              <p className="opacity-50 mb-2 text-[10px] uppercase tracking-wider">
                Get Started
              </p>
              <motion.button
                whileHover={{ scale: 1.01, borderColor: "rgba(255,255,255,0.5)" }}
                whileTap={{ scale: 0.99 }}
                onClick={login}
                className="border border-white/20 px-4 py-2 w-full text-left"
              >
                Log in with Email or Phone
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="mb-8"
          >
            {/* Balances */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="mb-2"
            >
              <CompactBalances
                balances={balances}
                loading={loading}
                walletAddress={walletAddress}
              />
            </motion.div>

            {/* Actions */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border-t border-white/20 pt-6"
            >
              <p className="text-[10px] opacity-50 uppercase tracking-wider mb-4">
                Actions
              </p>
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.15 }}
              >
                <Link
                  href="/create"
                  className="border border-white/20 px-4 py-3 hover:border-white/50 block"
                >
                  <span className="opacity-90">Create Payment Link</span>
                  <span className="block text-[10px] opacity-40 mt-1">
                    Generate a shareable checkout URL for any stablecoin
                  </span>
                </Link>
              </motion.div>
            </motion.div>

            {/* Recent Payments */}
            {authenticated && (
              <motion.div
                variants={fadeInUp}
                transition={{ duration: 0.3 }}
              >
                <RecentPayments payments={payments} />
              </motion.div>
            )}

            {/* Logout */}
            <motion.div
              variants={fadeInUp}
              transition={{ duration: 0.3 }}
              className="border-t border-white/20 pt-4 mt-6"
            >
              <motion.button
                whileHover={{ opacity: 0.5 }}
                onClick={logout}
                className="text-[10px] opacity-30 uppercase tracking-wider"
              >
                Log Out
              </motion.button>
            </motion.div>
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="border-t border-white/20 pt-4 text-[10px] opacity-30 text-center"
        >
          <p>Built on Tempo &middot; Gasless &middot; Any Stablecoin</p>
        </motion.div>
      </div>
    </motion.div>
  );
}
