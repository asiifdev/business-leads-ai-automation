"use client";

import { motion } from "framer-motion";

export function AuthMotionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="relative z-10 w-full max-w-md px-4"
    >
      {children}
    </motion.div>
  );
}
