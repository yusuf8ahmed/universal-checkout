import { motion } from "motion/react";
import { GlassCard } from "./GlassCard";

const pulse = {
  animate: { opacity: [0.1, 0.2, 0.1] },
  transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" as const },
};

export function SkeletonCard() {
  return (
    <GlassCard padding="lg" className="mb-6">
      <div>
        <motion.div
          animate={pulse.animate}
          transition={pulse.transition}
          className="h-3 w-24 rounded mb-6"
          style={{ background: "rgba(255, 255, 255, 0.15)" }}
        />
        <motion.div
          animate={pulse.animate}
          transition={{ ...pulse.transition, delay: 0.2 }}
          className="h-16 w-48 rounded mb-8"
          style={{ background: "rgba(255, 255, 255, 0.15)" }}
        />
        <motion.div
          animate={pulse.animate}
          transition={{ ...pulse.transition, delay: 0.4 }}
          className="h-3 w-32 rounded"
          style={{ background: "rgba(255, 255, 255, 0.15)" }}
        />
      </div>
    </GlassCard>
  );
}
