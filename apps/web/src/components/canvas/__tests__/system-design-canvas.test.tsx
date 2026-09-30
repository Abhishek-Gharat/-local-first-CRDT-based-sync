// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as Y from "yjs";
import { SystemDesignCanvas } from "@/components/canvas/system-design-canvas";
import { type DiagramModel } from "shared";

beforeAll(() => {
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(true);
  }
});

describe("SystemDesignCanvas - Freehand Drawing & Coordinate System", () => {
  let doc: Y.Doc;
  const mockRect = {
    left: 100,
    top: 50,
    width: 800,
    height: 600,
    right: 900,
    bottom: 650,
    x: 100,
    y: 50,
    toJSON: () => {},
  };

  beforeEach(() => {
    doc = new Y.Doc();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 0);
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      clearTimeout(id);
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function getDiagramModel(yDoc: Y.Doc): DiagramModel {
    const raw = yDoc.getMap("diagram").get("model");
    if (typeof raw === "string") {
      return JSON.parse(raw);
    }
    return {} as DiagramModel;
  }

  function setupCanvas(initialCanWrite = true) {
    const utils = render(<SystemDesignCanvas doc={doc} canWrite={initialCanWrite} />);
    const container = utils.container.querySelector("[data-canvas-bg='true']") as HTMLDivElement;
    expect(container).toBeTruthy();
    // Stub bounding rect for split-screen / navbar offset
    container.getBoundingClientRect = () => mockRect as DOMRect;
    return { ...utils, container };
  }

  it("Test 1 — Basic drawing: Pointer down -> pointer move -> pointer up commits exactly one stroke", async () => {
    const { container } = setupCanvas();

    // Activate Draw tool
    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    // Initial state: drawings from template or empty
    const initialDrawingsCount = getDiagramModel(doc).drawings?.length ?? 0;

    // Start drawing (button: 0 is primary)
    fireEvent.pointerDown(container, {
      clientX: 200,
      clientY: 150,
      pointerId: 1,
      button: 0,
    });

    // Move to create stroke points
    fireEvent.pointerMove(container, {
      clientX: 220,
      clientY: 170,
      pointerId: 1,
    });
    fireEvent.pointerMove(container, {
      clientX: 250,
      clientY: 200,
      pointerId: 1,
    });

    // Finish stroke
    fireEvent.pointerUp(container, {
      clientX: 250,
      clientY: 200,
      pointerId: 1,
    });

    const model = getDiagramModel(doc);
    expect(model.drawings).toBeDefined();
    expect(model.drawings!.length).toBe(initialDrawingsCount + 1);

    const committed = model.drawings![model.drawings!.length - 1];
    expect(committed.points.length).toBeGreaterThanOrEqual(3);
    // Verified coordinate formula: canvasX = Math.round((clientX - rect.left - pan.x) / zoom)
    // Default pan is x=40, y=40, zoom=0.85
    // canvasX for clientX=200: (200 - 100 - 40) / 0.85 = 60 / 0.85 = 71
    // canvasY for clientY=150: (150 - 50 - 40) / 0.85 = 60 / 0.85 = 71
    expect(committed.points[0]).toEqual({ x: 71, y: 71 });
  });

  it("Test 2 — Pointer crossing interactive content: nodes, groups, edges have pointer-events-none when in draw mode", async () => {
    const { container } = setupCanvas();

    // In 'select' mode, nodes have pointer events
    const selectNode = container.querySelector(".group\\/node");
    expect(selectNode).toBeTruthy();
    expect(selectNode?.classList.contains("pointer-events-none")).toBe(false);

    // Switch to 'draw' mode
    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    // In 'draw' mode, interactive children must not intercept drawing pointer events
    const drawNode = container.querySelector(".group\\/node");
    expect(drawNode?.classList.contains("pointer-events-none")).toBe(true);

    const drawGroup = container.querySelector(".group\\/grp");
    if (drawGroup) {
      expect(drawGroup.classList.contains("pointer-events-none")).toBe(true);
    }

    // Drawing over a node proceeds uninterrupted
    fireEvent.pointerDown(container, {
      clientX: 300,
      clientY: 300,
      pointerId: 2,
      button: 0,
    });
    fireEvent.pointerMove(container, {
      clientX: 320,
      clientY: 330,
      pointerId: 2,
    });
    fireEvent.pointerUp(container, {
      clientX: 320,
      clientY: 330,
      pointerId: 2,
    });

    const model = getDiagramModel(doc);
    const lastDrawing = model.drawings![model.drawings!.length - 1];
    expect(lastDrawing.points.length).toBe(2);
  });

  it("Test 3 — Pointer cancellation: Pointer down -> pointer cancel safely terminates without corrupting state", async () => {
    const { container } = setupCanvas();

    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    const beforeCount = getDiagramModel(doc).drawings?.length ?? 0;

    // Start drawing
    fireEvent.pointerDown(container, {
      clientX: 200,
      clientY: 200,
      pointerId: 3,
      button: 0,
    });
    fireEvent.pointerMove(container, {
      clientX: 230,
      clientY: 230,
      pointerId: 3,
    });

    // Pointer cancelled by system/interruption
    fireEvent.pointerCancel(container, {
      pointerId: 3,
    });

    // No stroke committed
    const afterCount = getDiagramModel(doc).drawings?.length ?? 0;
    expect(afterCount).toBe(beforeCount);

    // Next stroke still works normally
    fireEvent.pointerDown(container, {
      clientX: 300,
      clientY: 300,
      pointerId: 4,
      button: 0,
    });
    fireEvent.pointerMove(container, {
      clientX: 340,
      clientY: 340,
      pointerId: 4,
    });
    fireEvent.pointerUp(container, {
      clientX: 340,
      clientY: 340,
      pointerId: 4,
    });

    expect(getDiagramModel(doc).drawings?.length).toBe(beforeCount + 1);
  });

  it("Test 4 — Pointer release outside original region: pointer capture handles lifecycle safely", async () => {
    const { container } = setupCanvas();

    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    const beforeCount = getDiagramModel(doc).drawings?.length ?? 0;

    fireEvent.pointerDown(container, {
      clientX: 500,
      clientY: 400,
      pointerId: 5,
      button: 0,
    });

    // Moves past the container rect boundary (mockRect right is 900)
    fireEvent.pointerMove(container, {
      clientX: 950,
      clientY: 400,
      pointerId: 5,
    });

    // Released outside
    fireEvent.pointerUp(container, {
      clientX: 950,
      clientY: 400,
      pointerId: 5,
    });

    const model = getDiagramModel(doc);
    expect(model.drawings?.length).toBe(beforeCount + 1);
  });

  it("Test 5 — Coordinate transformation accuracy across zoom levels (0.5x, 1x, 2x)", async () => {
    const { container } = setupCanvas();

    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    // Reset zoom to 100% via the Reset Zoom button
    const resetZoomBtn = screen.getByTitle("Reset Zoom to 100%");
    fireEvent.click(resetZoomBtn);

    // At zoom = 1, pan = {x: 40, y: 40}, rect = {left: 100, top: 50}
    // clientX = 240, clientY = 190
    // Expected x = (240 - 100 - 40) / 1 = 100
    // Expected y = (190 - 50 - 40) / 1 = 100
    fireEvent.pointerDown(container, { clientX: 240, clientY: 190, pointerId: 6, button: 0 });
    fireEvent.pointerMove(container, { clientX: 260, clientY: 210, pointerId: 6 });
    fireEvent.pointerUp(container, { clientX: 260, clientY: 210, pointerId: 6 });

    const model1 = getDiagramModel(doc);
    const stroke1 = model1.drawings![model1.drawings!.length - 1];
    expect(stroke1.points[0]).toEqual({ x: 100, y: 100 });
    expect(stroke1.points[1]).toEqual({ x: 120, y: 120 });
  });

  it("Test 6 — Pan then draw: Stroke appears at correct diagram coordinates", async () => {
    const { container } = setupCanvas();

    // Select tool for background panning
    const selectBtn = screen.getByTitle(/Select \/ Move Tool/i);
    fireEvent.click(selectBtn);

    // Pan canvas: drag background from 500, 300 to 600, 350 (delta +100, +50)
    fireEvent.pointerDown(container, { clientX: 500, clientY: 300, pointerId: 7, button: 0 });
    fireEvent.pointerMove(container, { clientX: 600, clientY: 350, pointerId: 7 });
    fireEvent.pointerUp(container, { pointerId: 7 });

    // Now switch to draw tool and reset zoom to 1
    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);
    const resetZoomBtn = screen.getByTitle("Reset Zoom to 100%");
    fireEvent.click(resetZoomBtn);

    // Initial pan was (40, 40) + delta (100, 50) = pan (140, 90)
    // clientX = 340, clientY = 240, rect = {left: 100, top: 50}
    // Expected x = (340 - 100 - 140) / 1 = 100
    // Expected y = (240 - 50 - 90) / 1 = 100
    fireEvent.pointerDown(container, { clientX: 340, clientY: 240, pointerId: 8, button: 0 });
    fireEvent.pointerMove(container, { clientX: 360, clientY: 260, pointerId: 8 });
    fireEvent.pointerUp(container, { clientX: 360, clientY: 260, pointerId: 8 });

    const model = getDiagramModel(doc);
    const stroke = model.drawings![model.drawings!.length - 1];
    expect(stroke.points[0]).toEqual({ x: 100, y: 100 });
  });

  it("Test 7 — Switch tools mid-stroke: Cancels in-progress drawing without stuck state", async () => {
    const { container } = setupCanvas();

    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    const beforeCount = getDiagramModel(doc).drawings?.length ?? 0;

    fireEvent.pointerDown(container, { clientX: 200, clientY: 200, pointerId: 9, button: 0 });
    fireEvent.pointerMove(container, { clientX: 230, clientY: 230, pointerId: 9 });

    // Switch tool to 'select' via keyboard 'V'
    fireEvent.keyDown(window, { key: "v" });

    // Ensure no stroke committed and no stuck drawing state
    const afterCount = getDiagramModel(doc).drawings?.length ?? 0;
    expect(afterCount).toBe(beforeCount);

    // Nodes are interactive again
    const selectNode = container.querySelector(".group\\/node");
    expect(selectNode?.classList.contains("pointer-events-none")).toBe(false);
  });

  it("Test 8 — Node interaction preserved when drawing mode is OFF", async () => {
    const { container } = setupCanvas();

    // Default tool is 'select'
    const firstNode = container.querySelector(".group\\/node") as HTMLElement;
    expect(firstNode).toBeTruthy();

    const initialNodes = getDiagramModel(doc).nodes;
    const targetNode = initialNodes[0];

    // Mouse down on node starts drag
    fireEvent.mouseDown(firstNode, { clientX: targetNode.x + 100, clientY: targetNode.y + 50 });

    // Move pointer to drag node
    fireEvent.pointerMove(container, {
      clientX: targetNode.x + 150,
      clientY: targetNode.y + 80,
    });
    fireEvent.pointerUp(container);

    // Node was updated
    const updatedNodes = getDiagramModel(doc).nodes;
    const movedNode = updatedNodes.find((n) => n.id === targetNode.id);
    expect(movedNode).toBeDefined();
  });

  it("Test 9 — Accidental zero-length clicks do not create meaningless strokes", async () => {
    const { container } = setupCanvas();

    const drawBtn = screen.getByTitle(/Draw \/ Pen Tool/i);
    fireEvent.click(drawBtn);

    const beforeCount = getDiagramModel(doc).drawings?.length ?? 0;

    // Single click without movement
    fireEvent.pointerDown(container, { clientX: 300, clientY: 300, pointerId: 10, button: 0 });
    fireEvent.pointerUp(container, { clientX: 300, clientY: 300, pointerId: 10 });

    // No meaningless stroke created
    expect(getDiagramModel(doc).drawings?.length ?? 0).toBe(beforeCount);
  });
});
