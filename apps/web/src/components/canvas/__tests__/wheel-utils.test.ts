import { describe, it, expect } from "vitest";
import {
  normalizeWheelDelta,
  classifyWheelInteraction,
  getZoomFactor,
  clampZoom,
  calculateZoomAtPoint,
} from "../wheel-utils";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_FACTOR } from "../canvas-layers";

describe("normalizeWheelDelta", () => {
  it("handles deltaMode 0 (pixels)", () => {
    const result = normalizeWheelDelta({ deltaX: 0, deltaY: 100, deltaMode: 0 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(100);
    expect(result.magnitude).toBe(100);
  });

  it("handles deltaMode 1 (lines)", () => {
    const result = normalizeWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(48);
  });

  it("handles deltaMode 2 (pages)", () => {
    const result = normalizeWheelDelta({ deltaX: 0, deltaY: 1, deltaMode: 2 });
    expect(result.x).toBe(0);
    expect(result.y).toBe(800);
  });

  it("handles small deltas", () => {
    const result = normalizeWheelDelta({ deltaX: 1, deltaY: 2, deltaMode: 0 });
    expect(result.magnitude).toBeCloseTo(Math.hypot(1, 2), 5);
  });

  it("handles large deltas", () => {
    const result = normalizeWheelDelta({ deltaX: 0, deltaY: 500, deltaMode: 0 });
    expect(result.magnitude).toBe(500);
  });

  it("handles zero delta", () => {
    const result = normalizeWheelDelta({ deltaX: 0, deltaY: 0, deltaMode: 0 });
    expect(result.magnitude).toBe(0);
  });
});

describe("classifyWheelInteraction", () => {
  it("classifies ctrl+wheel as zoom", () => {
    expect(classifyWheelInteraction({ ctrlKey: true, metaKey: false, deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe("zoom");
  });

  it("classifies cmd+wheel as zoom", () => {
    expect(classifyWheelInteraction({ ctrlKey: false, metaKey: true, deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe("zoom");
  });

  it("classifies normal wheel as pan", () => {
    expect(classifyWheelInteraction({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 100, deltaMode: 0 })).toBe("pan");
  });

  it("classifies tiny trackpad movement as none", () => {
    expect(classifyWheelInteraction({ ctrlKey: false, metaKey: false, deltaX: 0, deltaY: 1, deltaMode: 0 })).toBe("none");
  });

  it("classifies two-finger scroll as pan", () => {
    expect(classifyWheelInteraction({ ctrlKey: false, metaKey: false, deltaX: 5, deltaY: 10, deltaMode: 0 })).toBe("pan");
  });
});

describe("getZoomFactor", () => {
  const sensitivity = Math.log(ZOOM_FACTOR);

  it("returns 1 for zero delta", () => {
    expect(getZoomFactor(0, 0, sensitivity)).toBeCloseTo(1, 5);
  });

  it("returns > 1 for negative delta (zoom in)", () => {
    expect(getZoomFactor(-100, 0, sensitivity)).toBeGreaterThan(1);
  });

  it("returns < 1 for positive delta (zoom out)", () => {
    expect(getZoomFactor(100, 0, sensitivity)).toBeLessThan(1);
  });

  it("handles deltaMode 1", () => {
    const factor = getZoomFactor(-3, 1, sensitivity);
    expect(factor).toBeGreaterThan(1);
  });

  it("handles deltaMode 2", () => {
    const factor = getZoomFactor(-1, 2, sensitivity);
    expect(factor).toBeGreaterThan(1);
  });

  it("clamps large deltas", () => {
    const factor = getZoomFactor(1000, 0, sensitivity);
    expect(factor).toBeLessThanOrEqual(ZOOM_FACTOR * 1.5);
  });

  it("produces consistent results for same input", () => {
    const f1 = getZoomFactor(-50, 0, sensitivity);
    const f2 = getZoomFactor(-50, 0, sensitivity);
    expect(f1).toBe(f2);
  });
});

describe("clampZoom", () => {
  it("clamps to MIN_ZOOM", () => {
    expect(clampZoom(0.01, MIN_ZOOM, MAX_ZOOM)).toBe(MIN_ZOOM);
  });

  it("clamps to MAX_ZOOM", () => {
    expect(clampZoom(10, MIN_ZOOM, MAX_ZOOM)).toBe(MAX_ZOOM);
  });

  it("passes through valid values", () => {
    expect(clampZoom(1, MIN_ZOOM, MAX_ZOOM)).toBe(1);
  });

  it("handles NaN", () => {
    expect(clampZoom(NaN, MIN_ZOOM, MAX_ZOOM)).toBe(MIN_ZOOM);
  });

  it("handles Infinity", () => {
    expect(clampZoom(Infinity, MIN_ZOOM, MAX_ZOOM)).toBe(MAX_ZOOM);
  });
});

describe("calculateZoomAtPoint", () => {
  it("preserves world point under cursor", () => {
    const result = calculateZoomAtPoint(1, 2, 100, 100, 0, 0, 300, 300);
    const worldX = (300 - 0 - 100) / 1;
    const worldY = (300 - 0 - 100) / 1;
    expect(result.x).toBe(300 - 0 - worldX * 2);
    expect(result.y).toBe(300 - 0 - worldY * 2);
  });

  it("handles zoom out", () => {
    const result = calculateZoomAtPoint(2, 0.5, 50, 50, 0, 0, 200, 200);
    const worldX = (200 - 0 - 50) / 2;
    const worldY = (200 - 0 - 50) / 2;
    expect(result.x).toBe(200 - 0 - worldX * 0.5);
    expect(result.y).toBe(200 - 0 - worldY * 0.5);
  });

  it("handles non-zero canvas origin", () => {
    const result = calculateZoomAtPoint(1, 1.5, 100, 100, 50, 50, 300, 300);
    const worldX = (300 - 50 - 100) / 1;
    const worldY = (300 - 50 - 100) / 1;
    expect(result.x).toBe(300 - 50 - worldX * 1.5);
    expect(result.y).toBe(300 - 50 - worldY * 1.5);
  });
});

describe("zoom consistency", () => {
  const sensitivity = Math.log(ZOOM_FACTOR);

  it("wheel zoom and button zoom use same progression", () => {
    const buttonZoom = 1 * ZOOM_FACTOR;
    const wheelZoom = 1 * getZoomFactor(-120, 0, sensitivity);
    expect(wheelZoom).toBeCloseTo(buttonZoom, 5);
  });

  it("multiple zoom in/out returns to original", () => {
    let zoom = 1;
    for (let i = 0; i < 5; i++) {
      zoom *= getZoomFactor(-100, 0, sensitivity);
    }
    for (let i = 0; i < 5; i++) {
      zoom *= getZoomFactor(100, 0, sensitivity);
    }
    expect(zoom).toBeCloseTo(1, 5);
  });

  it("zoom at minimum stays at minimum", () => {
    let zoom = MIN_ZOOM;
    zoom *= getZoomFactor(100, 0, sensitivity);
    zoom = clampZoom(zoom, MIN_ZOOM, MAX_ZOOM);
    expect(zoom).toBe(MIN_ZOOM);
  });

  it("zoom at maximum stays at maximum", () => {
    let zoom = MAX_ZOOM;
    zoom *= getZoomFactor(-100, 0, sensitivity);
    zoom = clampZoom(zoom, MIN_ZOOM, MAX_ZOOM);
    expect(zoom).toBe(MAX_ZOOM);
  });
});
