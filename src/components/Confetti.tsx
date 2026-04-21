import { useEffect, useRef } from "react";

type Props = {
  /** Increment this number to fire a burst. */
  trigger: number;
  /** Optional palette override. Defaults to blaze/volt/chalk. */
  colors?: string[];
  /** Particle count; 140 feels celebratory without hurting mobile fps. */
  count?: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rot: number;
  vr: number;
  life: number; // seconds remaining
};

const DEFAULT_COLORS = ["#ff3b1f", "#f5ff1f", "#f5f2e8"];

export function Confetti({ trigger, colors = DEFAULT_COLORS, count = 140 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTrigger = useRef<number>(0);

  useEffect(() => {
    if (trigger === 0 || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Spawn particles from the middle-top of the screen, spraying out.
    const cx = w / 2;
    const cy = h * 0.28;
    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.05;
      const speed = 320 + Math.random() * 340;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 8,
        life: 2.2 + Math.random() * 0.8,
      });
    }
    particlesRef.current = particles;

    let last = performance.now();
    const gravity = 900;
    const drag = 0.985;

    const tick = (now: number) => {
      const dt = Math.min(0.045, (now - last) / 1000);
      last = now;

      ctx.clearRect(0, 0, w, h);
      let alive = 0;
      for (const p of particlesRef.current) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.vy += gravity * dt;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        if (p.life > 0) alive++;

        const alpha = Math.min(1, p.life * 2);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.4);
        ctx.restore();
      }

      if (alive > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, w, h);
        rafRef.current = null;
      }
    };

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [trigger, colors, count]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden="true"
    />
  );
}
