import { useState } from "react";
import { motion } from "framer-motion";
import { haptic } from "../lib/haptics";
import {
  requestAllPermissions,
  markPrimerDone,
  type PrimerReport,
} from "../lib/permissions";

type Props = {
  onGranted: () => void;
  /** Whether to include the microphone in the request. Default false
   *  because opening the mic degrades the output audio quality. */
  includeMic?: boolean;
};

export function PermissionPrimer({ onGranted, includeMic = false }: Props) {
  const [state, setState] = useState<"idle" | "requesting" | "done" | "partial">("idle");
  const [report, setReport] = useState<PrimerReport | null>(null);

  const prime = async () => {
    if (state === "requesting") return;
    haptic("press");
    setState("requesting");
    const r = await requestAllPermissions({ mic: includeMic });
    setReport(r);
    markPrimerDone(r);
    if (r.ready) {
      setState("done");
      haptic("success");
      setTimeout(onGranted, 350);
    } else {
      setState("partial");
      haptic("fail");
    }
  };

  const label =
    state === "requesting" ? "REQUESTING…"
      : state === "done" ? "READY"
      : state === "partial" ? "RETRY"
      : "START BROADCAST KIT";

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[var(--color-volt)]/60 bg-[var(--color-ink-2)]/80 p-4 scanline"
    >
      <div className="mb-2 font-display text-xs uppercase tracking-[0.3em] text-[var(--color-volt)]">
        one-time setup
      </div>
      <div className="font-display text-[clamp(1.2rem,5vw,1.5rem)] leading-tight text-[var(--color-chalk)]">
        Allow the broadcast to track your pace and distance.
      </div>
      <ul className="mt-2 space-y-1 text-[13px] leading-snug text-[var(--color-chalk)]/75">
        <li>🏃 Motion — so pace surges trigger reactions</li>
        <li>📍 Location — so distance tracks accurately</li>
        {includeMic && <li>🎙 Microphone — so the commentator can quote you live</li>}
      </ul>

      <motion.button
        type="button"
        onClick={prime}
        disabled={state === "requesting"}
        whileTap={{ scale: 0.97 }}
        className={`mt-4 flex min-h-[52px] w-full items-center justify-center rounded-lg border-2 px-4 font-display text-base uppercase tracking-[0.22em] transition ${
          state === "done"
            ? "border-[var(--color-volt)] bg-[var(--color-volt)]/15 text-[var(--color-volt)]"
            : state === "partial"
            ? "border-[var(--color-blaze)] bg-[var(--color-blaze)]/10 text-[var(--color-blaze)]"
            : "border-[var(--color-chalk)] bg-[var(--color-chalk)] text-[var(--color-ink)] hover:bg-[var(--color-chalk)]/90"
        }`}
      >
        {label}
      </motion.button>

      {state === "partial" && report && (
        <div className="mt-3 rounded-lg border border-[var(--color-blaze)]/40 bg-[var(--color-blaze)]/5 p-3 text-[12px] leading-snug text-[var(--color-chalk)]/85">
          <div className="font-display mb-1 text-[11px] uppercase tracking-[0.25em] text-[var(--color-blaze)]">
            couldn't get everything
          </div>
          <ul className="space-y-0.5">
            <li>Mic: {report.microphone}</li>
            <li>Motion: {report.motion}</li>
            <li>Location: {report.geolocation}</li>
          </ul>
          <div className="mt-2">
            Mic access is required for the mic-quote feature. Open your
            phone's site settings for this page and allow it, then retry.
            You can still broadcast without motion / location.
          </div>
        </div>
      )}

      {includeMic && (
        <div className="mt-3 rounded-md border border-[var(--color-line)] bg-[var(--color-ink)]/70 p-2.5 text-[12px] leading-snug text-[var(--color-chalk)]/70">
          <strong className="text-[var(--color-chalk)]">Headphones strongly recommended.</strong>{" "}
          With the mic on, most phones engage echo cancellation on all playback — which makes the commentary sound robotic unless you use earbuds.
        </div>
      )}
    </motion.section>
  );
}
