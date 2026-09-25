import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Smartphone, X, Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install.ts";

export default function PwaInstallBanner() {
  const { canInstall, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
      >
        <div
          className="rounded-xl border p-4 flex items-center gap-3 shadow-2xl"
          style={{
            background: "oklch(0.1 0.04 145 / 0.95)",
            borderColor: "#00f5d4",
            boxShadow: "0 0 20px #00f5d420",
            backdropFilter: "blur(12px)",
          }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "#00f5d415", border: "1px solid #00f5d440" }}
          >
            <Smartphone className="w-5 h-5" style={{ color: "#00f5d4" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold tracking-widest" style={{ color: "#00f5d4" }}>
              INSTALL LDWMS
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to home screen for quick access
            </p>
          </div>
          <button
            onClick={install}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider cursor-pointer flex-shrink-0"
            style={{ background: "#00f5d4", color: "#050c18" }}
          >
            <Download className="w-3 h-3" />
            INSTALL
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded cursor-pointer text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
