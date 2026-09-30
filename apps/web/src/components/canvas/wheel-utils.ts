export type WheelInteraction = "zoom" | "pan" | "none";

export interface NormalizedWheelDelta {
  x: number;
  y: number;
  magnitude: number;
}

const LINE_HEIGHT = 16;
const PAGE_HEIGHT = 800;

export function normalizeWheelDelta(e: {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}): NormalizedWheelDelta {
  const mode = e.deltaMode ?? 0;
  const unit = mode === 0 ? 1 : mode === 1 ? LINE_HEIGHT : PAGE_HEIGHT;
  const x = e.deltaX * unit;
  const y = e.deltaY * unit;
  const magnitude = Math.hypot(x, y);
  return { x, y, magnitude };
}

export function classifyWheelInteraction(e: {
  ctrlKey: boolean;
  metaKey: boolean;
  deltaX: number;
  deltaY: number;
  deltaMode: number;
}): WheelInteraction {
  if (e.ctrlKey || e.metaKey) return "zoom";
  const { magnitude } = normalizeWheelDelta(e);
  if (magnitude < 2) return "none";
  return "pan";
}

export function getZoomFactor(
  deltaY: number,
  deltaMode: number,
  sensitivity: number,
): number {
  const mode = deltaMode ?? 0;
  const unit = mode === 0 ? 1 : mode === 1 ? LINE_HEIGHT : PAGE_HEIGHT;
  const normalized = (-deltaY * unit) / 120;
  const clamped = Math.max(-1, Math.min(1, normalized));
  return Math.exp(clamped * sensitivity);
}

export function clampZoom(zoom: number, min: number, max: number): number {
  if (Number.isNaN(zoom)) return min;
  if (zoom === Infinity) return max;
  if (zoom === -Infinity) return min;
  return Math.min(max, Math.max(min, zoom));
}

export function calculateZoomAtPoint(
  oldZoom: number,
  newZoom: number,
  panX: number,
  panY: number,
  rectLeft: number,
  rectTop: number,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const worldX = (clientX - rectLeft - panX) / oldZoom;
  const worldY = (clientY - rectTop - panY) / oldZoom;
  return {
    x: clientX - rectLeft - worldX * newZoom,
    y: clientY - rectTop - worldY * newZoom,
  };
}
