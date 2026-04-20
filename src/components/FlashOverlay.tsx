import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Line } from "../lib/commentary";

export function FlashOverlay({ line }: { line: Line | null }) {
  const [key, setKey] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!line) return;
    if (line.urgency < 3) return;
    setKey((k) => k + 1);
    setActive(true);
    const t = setTimeout(() => setActive(false), 600);
    return () => clearTimeout(t);
  }, [line]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={key}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 z-10"
          style={{
            background:
              "radial-gradient(circle at 50% 40%, rgba(255,59,31,0.55), rgba(255,59,31,0) 60%), linear-gradient(180deg, rgba(245,255,31,0.1), transparent 30%)",
          }}
        />
      )}
    </AnimatePresence>
  );
}
