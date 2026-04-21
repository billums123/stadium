const PHRASES = [
  "LIVE AI BROADCAST · CH. 01",
  "PLAY-BY-PLAY · COLOR COMMENTARY · CROWD · MUSIC",
  "BUILT FOR WALKS · RUNS · RIDES",
  "GOAL-REACTIVE · PACE-REACTIVE",
];

export function Ticker({ accent = "blaze" }: { accent?: "blaze" | "volt" }) {
  const color = accent === "blaze" ? "text-[var(--color-blaze)]" : "text-[var(--color-volt)]";
  const items = [...PHRASES, ...PHRASES];
  return (
    <div className="relative overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-ink-2)]/70 py-3">
      <div className={`ticker-track font-display tracking-[0.2em] text-sm uppercase leading-6 ${color}`}>
        {items.map((t, i) => (
          <span key={i} className="mx-6 whitespace-nowrap">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
