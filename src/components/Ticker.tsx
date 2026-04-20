const PHRASES = [
  "★ BROADCASTING EVERY STEP ★",
  "BUILT FOR RUNNERS · WALKERS · RIDERS",
  "POWERED BY ELEVENLABS",
  "SPEC-DRIVEN WITH KIRO",
  "YOU ARE NOT JOGGING — YOU ARE COMPETING",
  "IF THEY LAUGH, YOU WIN",
  "#ElevenHacks · #CodeWithKiro",
];

export function Ticker({ accent = "blaze" }: { accent?: "blaze" | "volt" }) {
  const color = accent === "blaze" ? "text-[var(--color-blaze)]" : "text-[var(--color-volt)]";
  const items = [...PHRASES, ...PHRASES];
  return (
    <div className="relative overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-ink-2)]/70 py-2">
      <div className={`ticker-track font-display tracking-[0.2em] text-sm uppercase ${color}`}>
        {items.map((t, i) => (
          <span key={i} className="mx-6 whitespace-nowrap">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
