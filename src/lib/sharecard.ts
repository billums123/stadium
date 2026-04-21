/**
 * Renders a photo-finish share card to a canvas and hands it off via
 * the Web Share API, falling back to a download for desktop browsers.
 * 1080x1920 to match vertical social feeds.
 */

import type { Line } from "./commentary";
import type { MotionState } from "./motion";
import { stripAudioTags } from "./tags";

export type ShareCardInput = {
  athleteName: string;
  line: Line | null;
  motion: MotionState;
  hypeScore: number;
};

const W = 1080;
const H = 1920;

export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");

  // Background gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b0b0e");
  bg.addColorStop(1, "#050505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Blaze halo.
  const halo = ctx.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H * 0.35, W * 0.85);
  halo.addColorStop(0, "rgba(255,59,31,0.35)");
  halo.addColorStop(1, "rgba(255,59,31,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // Scanlines.
  ctx.fillStyle = "rgba(255,255,255,0.022)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  // Header chrome.
  ctx.fillStyle = "#ff3b1f";
  roundRect(ctx, 60, 80, 110, 110, 24);
  ctx.fillStyle = "#f5f2e8";
  ctx.font = "900 96px 'Arial Black', Impact, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("S", 60 + 55, 80 + 57);

  ctx.textAlign = "left";
  ctx.font = "900 72px 'Arial Black', Impact, sans-serif";
  ctx.fillStyle = "#f5f2e8";
  ctx.fillText("STADIUM", 200, 80 + 55);

  ctx.font = "700 26px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#ff3b1f";
  ctx.fillText("LIVE · CH. 01", 200, 80 + 102);

  // "On air" dot.
  ctx.fillStyle = "#ff3b1f";
  ctx.beginPath();
  ctx.arc(W - 120, 135, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "700 26px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "#f5f2e8";
  ctx.textAlign = "right";
  ctx.fillText("ON AIR", W - 150, 140);

  // Athlete name + hype.
  ctx.textAlign = "left";
  ctx.fillStyle = "#8a8880";
  ctx.font = "700 30px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("ATHLETE", 70, 300);
  ctx.textAlign = "right";
  ctx.fillText("HYPE", W - 70, 300);

  ctx.fillStyle = "#f5f2e8";
  ctx.textAlign = "left";
  ctx.font = "900 140px 'Arial Black', Impact, sans-serif";
  ctx.fillText(clampWidth(ctx, input.athleteName || "THE ATHLETE", W - 320), 70, 430);

  ctx.fillStyle = "#f5ff1f";
  ctx.textAlign = "right";
  ctx.fillText(String(input.hypeScore), W - 70, 430);

  // Stat row — three equal columns centered so values never overflow.
  const statsY = 560;
  const padX = 70;
  const colW = (W - padX * 2) / 3;
  drawStat(ctx, padX + colW * 0, statsY, colW, "TIME", fmtDuration(input.motion.elapsedMs), "#f5f2e8");
  drawStat(ctx, padX + colW * 1, statsY, colW, "DIST", fmtDistance(input.motion.distanceMeters), "#f5f2e8");
  drawStat(
    ctx,
    padX + colW * 2,
    statsY,
    colW,
    "PACE",
    `${input.motion.paceKmh.toFixed(1)} kmh`,
    input.motion.paceKmh > 8 ? "#f5ff1f" : "#f5f2e8"
  );

  // Hype meter bar.
  const barY = 780;
  ctx.fillStyle = "#1a1a1d";
  roundRect(ctx, 70, barY, W - 140, 28, 14);
  const pct = Math.max(0, Math.min(100, input.hypeScore)) / 100;
  const barColor = pct > 0.75 ? "#ff3b1f" : pct > 0.45 ? "#f5ff1f" : "#f5f2e8";
  ctx.fillStyle = barColor;
  roundRect(ctx, 70, barY, (W - 140) * pct, 28, 14);

  // Play-by-play card.
  const cardY = 880;
  const cardH = 820;
  ctx.strokeStyle = "#ff3b1f";
  ctx.lineWidth = 6;
  roundRect(ctx, 70, cardY, W - 140, cardH, 28, true);

  ctx.fillStyle = "#8a8880";
  ctx.textAlign = "center";
  ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("PLAY-BY-PLAY", W / 2, cardY + 60);

  // Line text — chunky display, word wrapped.
  ctx.fillStyle = "#f5f2e8";
  ctx.font = "900 76px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "left";
  const text = input.line ? stripAudioTags(input.line.text) : "Every step. The main event.";
  wrapText(ctx, text, 120, cardY + 180, W - 240, 92);

  // Footer tag.
  ctx.fillStyle = "#8a8880";
  ctx.font = "700 30px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("EVERY STEP. THE MAIN EVENT.", W / 2, H - 70);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
      0.95
    );
  });
}

export async function shareCard(input: ShareCardInput): Promise<"shared" | "downloaded" | "copied"> {
  const blob = await renderShareCard(input);
  const file = new File([blob], "stadium-photofinish.png", { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: "STADIUM",
        text: "Every step. The main event.",
      });
      return "shared";
    } catch {
      // user dismissed the share sheet — fall through to download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stadium-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  stroke = false
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (stroke) ctx.stroke();
  else ctx.fill();
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  color: string
) {
  ctx.fillStyle = "#8a8880";
  ctx.textAlign = "left";
  ctx.font = "700 28px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = color;
  // Auto-shrink the value font so it always fits in the column width.
  let size = 88;
  ctx.font = `900 ${size}px 'Arial Black', Impact, sans-serif`;
  while (ctx.measureText(value).width > width - 20 && size > 42) {
    size -= 6;
    ctx.font = `900 ${size}px 'Arial Black', Impact, sans-serif`;
  }
  ctx.fillText(value, x, y + 92);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
) {
  const words = text.split(/\s+/);
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cursorY);
}

function clampWidth(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  let t = text;
  while (ctx.measureText(t).width > max && t.length > 1) t = t.slice(0, -1);
  return t === text ? t : t + "…";
}

function fmtDuration(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
