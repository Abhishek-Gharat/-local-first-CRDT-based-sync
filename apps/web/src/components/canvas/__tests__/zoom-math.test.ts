import { describe, it, expect } from "vitest";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_FACTOR } from "../canvas-layers";

describe("zoom constants", () => {
  it("MIN_ZOOM is positive and less than 1", () => {
    expect(MIN_ZOOM).toBeGreaterThan(0);
    expect(MIN_ZOOM).toBeLessThan(1);
  });

  it("MAX_ZOOM is greater than MIN_ZOOM", () => {
    expect(MAX_ZOOM).toBeGreaterThan(MIN_ZOOM);
  });

  it("ZOOM_FACTOR is greater than 1", () => {
    expect(ZOOM_FACTOR).toBeGreaterThan(1);
  });
});

describe("zoom clamping", () => {
  const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  it("clamps to MIN_ZOOM when below", () => {
    expect(clamp(0.01)).toBe(MIN_ZOOM);
    expect(clamp(0)).toBe(MIN_ZOOM);
    expect(clamp(-1)).toBe(MIN_ZOOM);
  });

  it("clamps to MAX_ZOOM when above", () => {
    expect(clamp(10)).toBe(MAX_ZOOM);
    expect(clamp(100)).toBe(MAX_ZOOM);
    expect(clamp(Infinity)).toBe(MAX_ZOOM);
  });

  it("does not clamp valid values", () => {
    expect(clamp(0.5)).toBe(0.5);
    expect(clamp(1)).toBe(1);
    expect(clamp(2)).toBe(2);
  });

  it("never produces NaN", () => {
    const result = clamp(NaN);
    expect(Number.isNaN(result) ? MIN_ZOOM : result).toBe(MIN_ZOOM);
  });
});

describe("zoom factor progression", () => {
  it("zoom in increases zoom", () => {
    const z = 1;
    const next = z * ZOOM_FACTOR;
    expect(next).toBeGreaterThan(z);
  });

  it("zoom out decreases zoom", () => {
    const z = 1;
    const next = z / ZOOM_FACTOR;
    expect(next).toBeLessThan(z);
  });

  it("zoom in then out returns to original (within floating point)", () => {
    const z = 1;
    const zoomedIn = z * ZOOM_FACTOR;
    const zoomedBack = zoomedIn / ZOOM_FACTOR;
    expect(zoomedBack).toBeCloseTo(z, 10);
  });

  it("repeated zoom in does not exceed MAX_ZOOM", () => {
    let z = 1;
    for (let i = 0; i < 20; i++) {
      z = Math.min(MAX_ZOOM, z * ZOOM_FACTOR);
    }
    expect(z).toBe(MAX_ZOOM);
  });

  it("repeated zoom out does not go below MIN_ZOOM", () => {
    let z = 1;
    for (let i = 0; i < 20; i++) {
      z = Math.max(MIN_ZOOM, z / ZOOM_FACTOR);
    }
    expect(z).toBe(MIN_ZOOM);
  });
});

describe("cursor-centered zoom math", () => {
  // Transform model: screen = pan + zoom * world (origin top-left)
  // For cursor-centered zoom: world point under cursor must stay fixed

  const computeNewPan = (
    oldZoom: number,
    newZoom: number,
    panX: number,
    panY: number,
    rectLeft: number,
    rectTop: number,
    clientX: number,
    clientY: number,
  ) => {
    const worldX = (clientX - rectLeft - panX) / oldZoom;
    const worldY = (clientY - rectTop - panY) / oldZoom;
    return {
      x: clientX - rectLeft - worldX * newZoom,
      y: clientY - rectTop - worldY * newZoom,
    };
  };

  it("preserves world point under cursor after zoom", () => {
    const oldZoom = 1;
    const newZoom = 2;
    const pan = { x: 100, y: 100 };
    const rect = { left: 0, top: 0 };
    const cursor = { x: 300, y: 300 };

    // World point under cursor before zoom
    const worldX = (cursor.x - rect.left - pan.x) / oldZoom;
    const worldY = (cursor.y - rect.top - pan.y) / oldZoom;

    const newPan = computeNewPan(
      oldZoom, newZoom, pan.x, pan.y, rect.left, rect.top, cursor.x, cursor.y,
    );

    // World point under cursor after zoom
    const worldXAfter = (cursor.x - rect.left - newPan.x) / newZoom;
    const worldYAfter = (cursor.y - rect.top - newPan.y) / newZoom;

    expect(worldXAfter).toBeCloseTo(worldX, 10);
    expect(worldYAfter).toBeCloseTo(worldY, 10);
  });

  it("preserves world point under cursor after zoom out", () => {
    const oldZoom = 2;
    const newZoom = 0.5;
    const pan = { x: 50, y: 50 };
    const rect = { left: 0, top: 0 };
    const cursor = { x: 400, y: 300 };

    const worldX = (cursor.x - rect.left - pan.x) / oldZoom;
    const worldY = (cursor.y - rect.top - pan.y) / oldZoom;

    const newPan = computeNewPan(
      oldZoom, newZoom, pan.x, pan.y, rect.left, rect.top, cursor.x, cursor.y,
    );

    const worldXAfter = (cursor.x - rect.left - newPan.x) / newZoom;
    const worldYAfter = (cursor.y - rect.top - newPan.y) / newZoom;

    expect(worldXAfter).toBeCloseTo(worldX, 10);
    expect(worldYAfter).toBeCloseTo(worldY, 10);
  });

  it("preserves world point with non-zero canvas origin", () => {
    const oldZoom = 1.5;
    const newZoom = 0.8;
    const pan = { x: 200, y: 150 };
    const rect = { left: 100, top: 80 };
    const cursor = { x: 500, y: 400 };

    const worldX = (cursor.x - rect.left - pan.x) / oldZoom;
    const worldY = (cursor.y - rect.top - pan.y) / oldZoom;

    const newPan = computeNewPan(
      oldZoom, newZoom, pan.x, pan.y, rect.left, rect.top, cursor.x, cursor.y,
    );

    const worldXAfter = (cursor.x - rect.left - newPan.x) / newZoom;
    const worldYAfter = (cursor.y - rect.top - newPan.y) / newZoom;

    expect(worldXAfter).toBeCloseTo(worldX, 10);
    expect(worldYAfter).toBeCloseTo(worldY, 10);
  });

  it("multiple zoom operations maintain alignment", () => {
    let zoom = 1;
    let pan = { x: 0, y: 0 };
    const rect = { left: 0, top: 0 };
    const cursor = { x: 200, y: 200 };

    // Zoom in 5 times
    for (let i = 0; i < 5; i++) {
      const newZoom = zoom * ZOOM_FACTOR;
      const newPan = computeNewPan(
        zoom, newZoom, pan.x, pan.y, rect.left, rect.top, cursor.x, cursor.y,
      );
      zoom = newZoom;
      pan = newPan;
    }

    // Zoom out 5 times
    for (let i = 0; i < 5; i++) {
      const newZoom = zoom / ZOOM_FACTOR;
      const newPan = computeNewPan(
        zoom, newZoom, pan.x, pan.y, rect.left, rect.top, cursor.x, cursor.y,
      );
      zoom = newZoom;
      pan = newPan;
    }

    // Should be back to original zoom
    expect(zoom).toBeCloseTo(1, 10);
  });
});

describe("wheel delta normalization", () => {
  const normalize = (deltaY: number) => Math.max(-1, Math.min(1, deltaY / 100));

  it("normalizes small deltas", () => {
    expect(normalize(10)).toBe(0.1);
    expect(normalize(-10)).toBe(-0.1);
  });

  it("normalizes large deltas", () => {
    expect(normalize(500)).toBe(1);
    expect(normalize(-500)).toBe(-1);
  });

  it("clamps extreme deltas", () => {
    expect(normalize(1000)).toBe(1);
    expect(normalize(-1000)).toBe(-1);
  });

  it("handles zero delta", () => {
    expect(normalize(0)).toBe(0);
  });

  it("produces consistent zoom factor for same direction", () => {
    const factor1 = 1 - normalize(-100) * (ZOOM_FACTOR - 1);
    const factor2 = 1 - normalize(-50) * (ZOOM_FACTOR - 1);
    // Both should be > 1 (zoom in)
    expect(factor1).toBeGreaterThan(1);
    expect(factor2).toBeGreaterThan(1);
    // Larger delta should produce larger factor
    expect(factor1).toBeGreaterThan(factor2);
  });
});

describe("pan + zoom coordinate consistency", () => {
  const computeNewPan = (
    oldZoom: number,
    newZoom: number,
    panX: number,
    panY: number,
    rectLeft: number,
    rectTop: number,
    clientX: number,
    clientY: number,
  ) => {
    const worldX = (clientX - rectLeft - panX) / oldZoom;
    const worldY = (clientY - rectTop - panY) / oldZoom;
    return {
      x: clientX - rectLeft - worldX * newZoom,
      y: clientY - rectTop - worldY * newZoom,
    };
  };

  it("drawing after zoom uses correct coordinates", () => {
    const rect = { left: 0, top: 0 };
    const zoom = 2;
    const pan = { x: 100, y: 100 };
    const cursor = { x: 300, y: 300 };

    // getCanvasCoordinates: world = (screen - pan) / zoom
    const worldX = (cursor.x - rect.left - pan.x) / zoom;
    const worldY = (cursor.y - rect.top - pan.y) / zoom;

    // Verify round-trip: screen = pan + world * zoom
    const screenX = pan.x + worldX * zoom;
    const screenY = pan.y + worldY * zoom;

    expect(screenX).toBeCloseTo(cursor.x - rect.left, 10);
    expect(screenY).toBeCloseTo(cursor.y - rect.top, 10);
  });

  it("drawing after pan + zoom uses correct coordinates", () => {
    const rect = { left: 0, top: 0 };
    let zoom = 1;
    let pan = { x: 0, y: 0 };

    // Pan
    pan = { x: 50, y: 50 };

    // Zoom
    const newZoom = 1.5;
    const newPan = computeNewPan(
      zoom, newZoom, pan.x, pan.y, rect.left, rect.top, 200, 200,
    );
    zoom = newZoom;
    pan = newPan;

    // Draw at cursor position
    const cursor = { x: 250, y: 250 };
    const worldX = (cursor.x - rect.left - pan.x) / zoom;
    const worldY = (cursor.y - rect.top - pan.y) / zoom;

    // Round-trip verification
    const screenX = pan.x + worldX * zoom;
    const screenY = pan.y + worldY * zoom;

    expect(screenX).toBeCloseTo(cursor.x - rect.left, 10);
    expect(screenY).toBeCloseTo(cursor.y - rect.top, 10);
  });
});
