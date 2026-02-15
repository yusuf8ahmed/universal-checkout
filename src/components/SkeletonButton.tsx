import { motion } from "motion/react";

export function SkeletonButton() {
  return (
    <motion.div
      animate={{ opacity: [0.1, 0.2, 0.1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      className="rounded-lg backdrop-blur-xl"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        height: "96px",
      }}
    />
  );
}
