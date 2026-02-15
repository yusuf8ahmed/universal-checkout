import { motion } from "motion/react";
import { WalletContainer } from "./WalletContainer";
import { WalletHeader } from "./WalletHeader";
import { SkeletonCard } from "./SkeletonCard";
import { SkeletonButton } from "./SkeletonButton";
import { GlassCard } from "./GlassCard";

export function SkeletonView() {
  return (
    <WalletContainer>
      <WalletHeader />
      <SkeletonCard />
      <div className="grid grid-cols-2 gap-4 mb-12">
        <SkeletonButton />
        <SkeletonButton />
      </div>
      <GlassCard>
        <motion.div
          animate={{ opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="h-3 w-28 rounded mb-6"
          style={{ background: "rgba(255, 255, 255, 0.1)" }}
        />
        <div className="space-y-4">
          <motion.div
            animate={{ opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="h-12 w-full rounded"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            />
          </motion.div>
          <motion.div
            animate={{ opacity: [0.05, 0.1, 0.05] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          >
            <div
              className="h-12 w-full rounded"
              style={{ background: "rgba(255, 255, 255, 0.05)" }}
            />
          </motion.div>
        </div>
      </GlassCard>
    </WalletContainer>
  );
}
