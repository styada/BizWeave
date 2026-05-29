"use client";

import { motion } from "framer-motion";

export function PageLoader({ message = "Weaving your workspace…" }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--bg-base)]">
      <div className="relative h-16 w-16">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2 border-[var(--accent-primary)]/30"
            style={{ borderTopColor: "var(--accent-primary)" }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <motion.p
        className="mt-6 text-sm text-[var(--text-secondary)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {message}
      </motion.p>
    </div>
  );
}
