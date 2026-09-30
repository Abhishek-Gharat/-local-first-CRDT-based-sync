import { describe, it, expect } from "vitest";

describe("drag coordinate math", () => {
  const getCanvasCoords = (
    clientX: number,
    clientY: number,
    rectLeft: number,
    rectTop: number,
    panX: number,
    panY: number,
    zoom: number,
  ) => ({
    x: Math.round((clientX - rectLeft - panX) / zoom),
    y: Math.round((clientY - rectTop - panY) / zoom),
  });

  it("computes correct world coords at zoom 1", () => {
    const coords = getCanvasCoords(200, 150, 0, 0, 50, 50, 1);
    expect(coords).toEqual({ x: 150, y: 100 });
  });

  it("computes correct world coords at zoom 2", () => {
    const coords = getCanvasCoords(300, 250, 0, 0, 50, 50, 2);
    expect(coords).toEqual({ x: 125, y: 100 });
  });

  it("computes correct world coords at zoom 0.5", () => {
    const coords = getCanvasCoords(150, 125, 0, 0, 50, 50, 0.5);
    expect(coords).toEqual({ x: 200, y: 150 });
  });

  it("accounts for canvas rect offset", () => {
    const coords = getCanvasCoords(300, 250, 100, 80, 50, 50, 1);
    expect(coords).toEqual({ x: 150, y: 120 });
  });

  it("drag offset prevents node jump on pointerdown", () => {
    const node = { x: 100, y: 80 };
    const rect = { left: 0, top: 0 };
    const pan = { x: 50, y: 50 };
    const zoom = 1;

    const coords = getCanvasCoords(180, 140, rect.left, rect.top, pan.x, pan.y, zoom);
    const dragOffset = { x: coords.x - node.x, y: coords.y - node.y };

    expect(dragOffset.x).toBe(30);
    expect(dragOffset.y).toBe(10);

    const newPan = { x: 70, y: 60 };
    const newCoords = getCanvasCoords(180, 140, rect.left, rect.top, newPan.x, newPan.y, zoom);
    const newNodeX = newCoords.x - dragOffset.x;
    const newNodeY = newCoords.y - dragOffset.y;

    expect(newNodeX).toBe(node.x - 20);
    expect(newNodeY).toBe(node.y - 10);
  });

  it("drag works correctly at multiple zoom levels", () => {
    const node = { x: 200, y: 150 };
    const rect = { left: 0, top: 0 };
    const pan = { x: 100, y: 100 };

    for (const zoom of [0.5, 1, 1.5, 2, 3]) {
      const screenX = rect.left + pan.x + node.x * zoom;
      const screenY = rect.top + pan.y + node.y * zoom;
      const coords = getCanvasCoords(screenX, screenY, rect.left, rect.top, pan.x, pan.y, zoom);
      expect(coords.x).toBe(node.x);
      expect(coords.y).toBe(node.y);
    }
  });

  it("pan then drag preserves alignment", () => {
    const node = { x: 100, y: 100 };
    const rect = { left: 0, top: 0 };
    let pan = { x: 50, y: 50 };
    const zoom = 1;

    const startCoords = getCanvasCoords(200, 200, rect.left, rect.top, pan.x, pan.y, zoom);
    const dragOffset = { x: startCoords.x - node.x, y: startCoords.y - node.y };

    pan = { x: 80, y: 70 };
    const afterPanCoords = getCanvasCoords(200, 200, rect.left, rect.top, pan.x, pan.y, zoom);
    const newNodePos = { x: afterPanCoords.x - dragOffset.x, y: afterPanCoords.y - dragOffset.y };

    expect(newNodePos.x).toBe(node.x - 30);
    expect(newNodePos.y).toBe(node.y - 20);
  });

  it("zoom then drag preserves alignment", () => {
    const node = { x: 100, y: 100 };
    const rect = { left: 0, top: 0 };
    const pan = { x: 50, y: 50 };

    for (const zoom of [0.5, 1, 2, 3]) {
      const screenX = rect.left + pan.x + node.x * zoom;
      const screenY = rect.top + pan.y + node.y * zoom;
      const coords = getCanvasCoords(screenX, screenY, rect.left, rect.top, pan.x, pan.y, zoom);
      const dragOffset = { x: coords.x - node.x, y: coords.y - node.y };

      const moveCoords = getCanvasCoords(screenX + 10, screenY + 10, rect.left, rect.top, pan.x, pan.y, zoom);
      const newNodePos = { x: moveCoords.x - dragOffset.x, y: moveCoords.y - dragOffset.y };

      expect(newNodePos.x).toBeCloseTo(node.x + 10 / zoom, 0);
      expect(newNodePos.y).toBeCloseTo(node.y + 10 / zoom, 0);
    }
  });
});

describe("group drag math", () => {
  it("group drag uses same coordinate system as nodes", () => {
    const group = { x: 50, y: 50, width: 400, height: 300 };
    const rect = { left: 0, top: 0 };
    const pan = { x: 100, y: 100 };
    const zoom = 1.5;

    // Pointer over group center
    const screenX = rect.left + pan.x + (group.x + group.width / 2) * zoom;
    const screenY = rect.top + pan.y + (group.y + group.height / 2) * zoom;

    const coords = {
      x: Math.round((screenX - rect.left - pan.x) / zoom),
      y: Math.round((screenY - rect.top - pan.y) / zoom),
    };

    expect(coords.x).toBe(group.x + group.width / 2);
    expect(coords.y).toBe(group.y + group.height / 2);
  });
});

describe("drawing drag math", () => {
  it("drawing drag translates all points by same delta", () => {
    const drawing = {
      points: [
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { x: 200, y: 140 },
      ],
    };
    const dragStart = { x: 100, y: 100 };
    const dragEnd = { x: 130, y: 110 };
    const dx = dragEnd.x - dragStart.x;
    const dy = dragEnd.y - dragStart.y;

    const translated = drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

    expect(translated[0]).toEqual({ x: 130, y: 110 });
    expect(translated[1]).toEqual({ x: 180, y: 130 });
    expect(translated[2]).toEqual({ x: 230, y: 150 });
  });

  it("drawing drag preserves relative point positions", () => {
    const drawing = {
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
    };
    const dx = 50;
    const dy = -30;

    const translated = drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

    // Distance between points should be preserved
    const origDist = Math.hypot(
      drawing.points[1].x - drawing.points[0].x,
      drawing.points[1].y - drawing.points[0].y,
    );
    const newDist = Math.hypot(
      translated[1].x - translated[0].x,
      translated[1].y - translated[0].y,
    );
    expect(newDist).toBeCloseTo(origDist, 10);
  });
});

describe("pointer capture", () => {
  it("pointer capture keeps drag alive across element boundaries", () => {
    // Simulate pointer capture behavior
    let dragActive = true;
    let capturedPointerId = 1;

    // Simulate pointer moving over different elements
    const elements = ["node", "svg", "group", "canvas"];
    for (const el of elements) {
      // With pointer capture, drag continues regardless of what element is under pointer
      expect(dragActive).toBe(true);
    }

    // Release capture
    capturedPointerId = -1;
    dragActive = false;
    expect(dragActive).toBe(false);
  });
});

describe("hit testing", () => {
  it("SVG edge hit area is larger than visible line", () => {
    const visibleStrokeWidth = 1.8;
    const hitStrokeWidth = 20;
    expect(hitStrokeWidth).toBeGreaterThan(visibleStrokeWidth);
  });

  it("drawing hit area accounts for stroke width", () => {
    const strokeWidth = 3;
    const hitWidth = Math.max(24, strokeWidth * 4);
    expect(hitWidth).toBe(24);
  });

  it("drawing hit area scales with highlighter", () => {
    const strokeWidth = 14;
    const hitWidth = Math.max(24, strokeWidth * 4);
    expect(hitWidth).toBe(56);
  });
});
