"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { Eraser } from "lucide-react";
import * as Y from "yjs";
import {
  type SystemNode,
  type SystemDrawing,
  type NodeType,
  type DiagramModel,
  SYSTEM_DESIGN_TEMPLATES,
} from "shared";
import { useDiagramCrdt } from "@/components/canvas/use-diagram-crdt";
import { AiDiagramModal } from "@/components/canvas/ai-diagram-modal";
import { cn } from "@/lib/utils";
import {
  CanvasNodesLayer,
  CanvasEdgesLayer,
  CanvasGroupsLayer,
  CanvasDrawingsLayer,
  ActiveStrokeLayer,
  CanvasToolbar,
  CanvasDrawSubPalette,
  CanvasHeaderControls,
  NodeEditDialog,
  COLOR_MAP,
  DRAW_PALETTE,
  pointsToSvgPath,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_FACTOR,
} from "./canvas-layers";
import {
  normalizeWheelDelta,
  classifyWheelInteraction,
  getZoomFactor,
  clampZoom,
} from "./wheel-utils";

export type CanvasTool =
  | "select"
  | "rectangle"
  | "circle"
  | "connect"
  | "draw"
  | "eraser"
  | "text"
  | "group";

interface SystemDesignCanvasProps {
  doc: Y.Doc;
  canWrite?: boolean;
  className?: string;
}

/**
 * Exports diagram as a standalone SVG file adapting to active theme
 */
function exportDiagramAsSvg(diagram: DiagramModel) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  diagram.nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });
  diagram.groups.forEach((g) => {
    minX = Math.min(minX, g.x);
    minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.width);
    maxY = Math.max(maxY, g.y + g.height);
  });
  diagram.drawings?.forEach((d) => {
    d.points.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
  });

  if (minX === Infinity) {
    minX = 0;
    minY = 0;
    maxX = 1200;
    maxY = 800;
  }

  const padding = 60;
  const vx = Math.round(minX - padding);
  const vy = Math.round(minY - padding);
  const vw = Math.round(maxX - minX + padding * 2);
  const vh = Math.round(maxY - minY + padding * 2);

  const isDarkMode =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");
  const bg = isDarkMode ? "#090a0f" : "#f8fafc";
  const nodeBg = isDarkMode ? "#18181b" : "#ffffff";
  const edgeColor = isDarkMode ? "#64748b" : "#475569";
  const textPrimary = isDarkMode ? "#ffffff" : "#0f172a";
  const textMuted = isDarkMode ? "#94a3b8" : "#64748b";

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" style="background:${bg};font-family:ui-sans-serif,system-ui,sans-serif;">\n`;
  svg += `  <defs>\n    <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">\n      <polygon points="0 0, 9 4.5, 0 9" fill="${edgeColor}" />\n    </marker>\n  </defs>\n`;

  // Groups
  diagram.groups.forEach((g) => {
    svg += `  <rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="16" fill="rgba(24,24,27,0.1)" stroke="${edgeColor}" stroke-dasharray="6,6" stroke-width="2" />\n`;
    svg += `  <text x="${g.x + 16}" y="${g.y + 26}" fill="${textPrimary}" font-weight="700" font-size="12px">${g.label}</text>\n`;
  });

  // Drawings
  diagram.drawings?.forEach((d) => {
    const pathD = pointsToSvgPath(d.points);
    const color = d.color === "auto" ? textPrimary : d.color;
    svg += `  <path d="${pathD}" fill="none" stroke="${color}" stroke-width="${d.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${d.tool === "highlighter" ? 0.45 : 1}" />\n`;
  });

  // Edges
  diagram.edges.forEach((e) => {
    const from = diagram.nodes.find((n) => n.id === e.from);
    const to = diagram.nodes.find((n) => n.id === e.to);
    if (from && to) {
      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height / 2;
      const x2 = to.x + to.width / 2;
      const y2 = to.y + to.height / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const cx1 = x1 + dx * 0.45;
      const cy1 = y1;
      const cx2 = x1 + dx * 0.55;
      const cy2 = y2;
      svg += `  <path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" fill="none" stroke="${edgeColor}" stroke-width="1.8" marker-end="url(#arrow)" />\n`;
      if (e.label) {
        svg += `  <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" fill="${textMuted}" font-size="11px" font-weight="600" text-anchor="middle">${e.label}</text>\n`;
      }
    }
  });

  // Nodes
  diagram.nodes.forEach((n) => {
    svg += `  <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="12" fill="${nodeBg}" stroke="#38bdf8" stroke-width="1.5" />\n`;
    svg += `  <text x="${n.x + 14}" y="${n.y + 28}" fill="${textPrimary}" font-weight="700" font-size="13px">${n.label}</text>\n`;
    if (n.sublabel) {
      svg += `  <text x="${n.x + 14}" y="${n.y + 46}" fill="${textMuted}" font-size="10px">${n.sublabel}</text>\n`;
    }
    if (n.technology) {
      svg += `  <text x="${n.x + 14}" y="${n.y + 66}" fill="${textMuted}" font-family="monospace" font-size="9px">${n.technology}</text>\n`;
    }
  });

  svg += `</svg>`;

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(diagram.title ?? "architecture-diagram").toLowerCase().replace(/\s+/g, "-")}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SystemDesignCanvas({
  doc,
  canWrite = true,
  className,
}: SystemDesignCanvasProps) {
  const {
    diagram,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    addGroup,
    updateGroup,
    deleteGroup,
    addDrawing,
    deleteDrawing,
    clearDrawings,
    setViewport,
    setFullDiagram,
    loadTemplate,
  } = useDiagramCrdt({ doc, canWrite });

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRectRef = useRef<DOMRect | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafViewportRef = useRef<number | null>(null);

  // Viewport Transform
  const [zoom, setZoom] = useState(diagram.viewport?.zoom ?? 0.85);
  const [pan, setPan] = useState({
    x: diagram.viewport?.x ?? 40,
    y: diagram.viewport?.y ?? 40,
  });
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    panRef.current = pan;
  }, [pan]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const zoomTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tools & Selection
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<SystemNode | null>(null);

  // Dialogs & Menus
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);

  // Freehand Drawing State & Refs
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<SystemDrawing | null>(null);
  const [drawColor, setDrawColor] = useState<string>("auto");
  const [drawWidth, setDrawWidth] = useState<number>(3);
  const [drawMode, setDrawMode] = useState<"pen" | "highlighter">("pen");
  const [isPointerDown, setIsPointerDown] = useState(false);

  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<SystemDrawing | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Dragging Node state (isolated from high-frequency Yjs serialization)
  const [draggedNode, setDraggedNode] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedNodeRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Dragging Group state
  const [draggedGroup, setDraggedGroup] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedGroupRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const groupDragOffsetRef = useRef({ x: 0, y: 0 });

  // Dragging Drawing state
  const [draggedDrawing, setDraggedDrawing] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const draggedDrawingRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const drawingDragOffsetRef = useRef({ x: 0, y: 0 });

  // Stable drawings ref for handleCanvasPointerUp
  const drawingsRef = useRef(diagram.drawings);
  useEffect(() => {
    drawingsRef.current = diagram.drawings;
  }, [diagram.drawings]);

  // Cached layout measurement API
  const updateCanvasRect = useCallback(() => {
    if (containerRef.current) {
      canvasRectRef.current = containerRef.current.getBoundingClientRect();
    }
    return canvasRectRef.current;
  }, []);

  // Imperative viewport transform update (bypasses React reconciliation)
  const updateViewportTransform = useCallback(() => {
    if (rafViewportRef.current) return;
    rafViewportRef.current = requestAnimationFrame(() => {
      rafViewportRef.current = null;
      if (viewportRef.current) {
        const { x, y } = panRef.current;
        const zoom = zoomRef.current;
        viewportRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
      }
    });
  }, []);

  // Debounced CRDT viewport persistence
  const persistViewport = useCallback(() => {
    if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    zoomTimeoutRef.current = setTimeout(() => {
      setViewport({ ...panRef.current, zoom: zoomRef.current });
    }, 250);
  }, [setViewport]);

  // Centralized cursor-centered zoom: adjusts pan so world point under cursor stays fixed
  const zoomAtPoint = useCallback(
    (nextZoom: number, clientX: number, clientY: number) => {
      if (!Number.isFinite(nextZoom)) return;
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const rect = canvasRectRef.current;
      if (!rect) return;

      const oldZoom = zoomRef.current;
      const oldPan = panRef.current;

      // World point under cursor before zoom
      const worldX = (clientX - rect.left - oldPan.x) / oldZoom;
      const worldY = (clientY - rect.top - oldPan.y) / oldZoom;

      // New pan keeps the same world point under cursor after zoom
      const newPan = {
        x: clientX - rect.left - worldX * clamped,
        y: clientY - rect.top - worldY * clamped,
      };

      setZoom(clamped);
      zoomRef.current = clamped;
      setPan(newPan);
      panRef.current = newPan;
      updateViewportTransform();
    },
    [updateViewportTransform],
  );

  useEffect(() => {
    updateCanvasRect();
    window.addEventListener("resize", updateCanvasRect);
    window.addEventListener("scroll", updateCanvasRect, true);
    return () => {
      window.removeEventListener("resize", updateCanvasRect);
      window.removeEventListener("scroll", updateCanvasRect, true);
    };
  }, [updateCanvasRect]);

  // Clean up any in-progress stroke if tool changes away from draw
  useEffect(() => {
    if (activeTool !== "draw" && isDrawingRef.current) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      setIsDrawing(false);
      setCurrentStroke(null);
    }
  }, [activeTool]);

  // Clean up requestAnimationFrame and timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, []);

  // macOS gesture events for pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let gestureZoom = 1;

    function onGestureStart(e: Event) {
      e.preventDefault();
      gestureZoom = zoomRef.current;
    }

    function onGestureChange(e: Event) {
      e.preventDefault();
      const ge = e as unknown as { scale: number };
      const nextZoom = clampZoom(gestureZoom * ge.scale, MIN_ZOOM, MAX_ZOOM);
      const rect = container?.getBoundingClientRect();
      if (rect) {
        zoomAtPoint(nextZoom, rect.left + rect.width / 2, rect.top + rect.height / 2);
        persistViewport();
      }
    }

    function onGestureEnd(e: Event) {
      e.preventDefault();
    }

    container.addEventListener("gesturestart", onGestureStart);
    container.addEventListener("gesturechange", onGestureChange);
    container.addEventListener("gestureend", onGestureEnd);

    return () => {
      container.removeEventListener("gesturestart", onGestureStart);
      container.removeEventListener("gesturechange", onGestureChange);
      container.removeEventListener("gestureend", onGestureEnd);
    };
  }, [zoomAtPoint, persistViewport]);

  // Precise diagram coordinate calculation with cached rect and refs
  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    const rect =
      canvasRectRef.current || containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.round((clientX - rect.left - panRef.current.x) / zoomRef.current),
      y: Math.round((clientY - rect.top - panRef.current.y) / zoomRef.current),
    };
  }, []);

  // Keyboard Shortcuts (matching standard architecture canvas tools)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.key === "Backspace" || e.key === "Delete") && canWrite) {
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
          setSelectedEdgeId(null);
        } else if (selectedDrawingId) {
          deleteDrawing(selectedDrawingId);
          setSelectedDrawingId(null);
        }
      } else if (e.key.toLowerCase() === "v") {
        setActiveTool("select");
      } else if (e.key.toLowerCase() === "p" || e.key.toLowerCase() === "d") {
        setActiveTool("draw");
      } else if (e.key.toLowerCase() === "e") {
        setActiveTool("eraser");
      } else if (e.key.toLowerCase() === "r") {
        setActiveTool("rectangle");
      } else if (e.key.toLowerCase() === "o") {
        setActiveTool("circle");
      } else if (e.key.toLowerCase() === "a" || e.key.toLowerCase() === "c") {
        setActiveTool("connect");
      } else if (e.key.toLowerCase() === "t") {
        setActiveTool("text");
      } else if (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "g") {
        setActiveTool("group");
      } else if (e.key.toLowerCase() === "j") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setAiModalOpen(true);
        } else {
          setInsertMenuOpen((prev) => !prev);
        }
      } else if (e.key === "+" || e.key === "=") {
        const rect = canvasRectRef.current;
        const cx = rect ? rect.left + rect.width / 2 : 0;
        const cy = rect ? rect.top + rect.height / 2 : 0;
        const next = Math.min(MAX_ZOOM, zoomRef.current * ZOOM_FACTOR);
        zoomAtPoint(next, cx, cy);
        persistViewport();
      } else if (e.key === "-" || e.key === "_") {
        const rect = canvasRectRef.current;
        const cx = rect ? rect.left + rect.width / 2 : 0;
        const cy = rect ? rect.top + rect.height / 2 : 0;
        const next = Math.max(MIN_ZOOM, zoomRef.current / ZOOM_FACTOR);
        zoomAtPoint(next, cx, cy);
        persistViewport();
      } else if (e.key === "0") {
        const rect = canvasRectRef.current;
        const cx = rect ? rect.left + rect.width / 2 : 0;
        const cy = rect ? rect.top + rect.height / 2 : 0;
        zoomAtPoint(1, cx, cy);
        persistViewport();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedNodeId,
    selectedEdgeId,
    selectedDrawingId,
    canWrite,
    deleteNode,
    deleteEdge,
    deleteDrawing,
  ]);

  // Mouse wheel & trackpad zoom with debounced CRDT synchronization
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const interaction = classifyWheelInteraction(e);

    if (interaction === "zoom") {
      e.preventDefault();
      const factor = getZoomFactor(e.deltaY, e.deltaMode, Math.log(ZOOM_FACTOR));
      const nextZoom = clampZoom(zoomRef.current * factor, MIN_ZOOM, MAX_ZOOM);
      zoomAtPoint(nextZoom, e.clientX, e.clientY);
      persistViewport();
    } else if (interaction === "pan") {
      const { x, y } = normalizeWheelDelta(e);
      const threshold = 2;
      if (Math.abs(x) > threshold || Math.abs(y) > threshold) {
        const nextPan = {
          x: panRef.current.x - x * 0.8,
          y: panRef.current.y - y * 0.8,
        };
        setPan(nextPan);
        panRef.current = nextPan;
        persistViewport();
      }
    }
  }, [zoomAtPoint, persistViewport]);

  // Canvas Pointer Handlers (Draw, Erase, Pan, Place Shapes)
  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setIsPointerDown(true);

    updateCanvasRect();
    const { x: canvasX, y: canvasY } = getCanvasCoordinates(e.clientX, e.clientY);

    // 1. FREEHAND DRAW TOOL
    if (activeTool === "draw" && canWrite) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Fallback if pointer capture is unavailable
      }
      isDrawingRef.current = true;
      const newStroke: SystemDrawing = {
        id: `draw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        points: [{ x: canvasX, y: canvasY }],
        color: drawColor,
        strokeWidth: drawMode === "highlighter" ? 14 : drawWidth,
        tool: drawMode,
      };
      currentStrokeRef.current = newStroke;
      setCurrentStroke(newStroke);
      setIsDrawing(true);
      return;
    }

    // 2. ERASER TOOL
    if (activeTool === "eraser") {
      return;
    }

    // 3. RECTANGLE TOOL
    if (activeTool === "rectangle" && canWrite) {
      const id = `node-${Date.now()}`;
      addNode({
        id,
        type: "service",
        label: "New Service Worker",
        sublabel: "Microservice / API",
        technology: "SERVICE",
        color: "violet",
        x: canvasX - 100,
        y: canvasY - 40,
        width: 200,
        height: 80,
      });
      setSelectedNodeId(id);
      setActiveTool("select");
      return;
    }

    // 4. CIRCLE / DATABASE TOOL
    if (activeTool === "circle" && canWrite) {
      const id = `node-${Date.now()}`;
      addNode({
        id,
        type: "database",
        label: "Primary Database",
        sublabel: "State Persistence",
        technology: "DATABASE",
        color: "emerald",
        x: canvasX - 95,
        y: canvasY - 45,
        width: 190,
        height: 90,
      });
      setSelectedNodeId(id);
      setActiveTool("select");
      return;
    }

    // 5. TEXT / ARCHITECTURE NOTE TOOL
    if (activeTool === "text" && canWrite) {
      const id = `node-${Date.now()}`;
      addNode({
        id,
        type: "text",
        label: "Architecture Note",
        sublabel: "Double-click to edit description",
        technology: "NOTE",
        color: "zinc",
        x: canvasX - 100,
        y: canvasY - 35,
        width: 200,
        height: 70,
      });
      setSelectedNodeId(id);
      setActiveTool("select");
      return;
    }

    // 6. ARCHITECTURE CONTAINER / GROUP TOOL
    if (activeTool === "group" && canWrite) {
      const id = `grp-${Date.now()}`;
      addGroup({
        id,
        label: "New Subnet / VPC Cluster",
        x: canvasX - 220,
        y: canvasY - 160,
        width: 440,
        height: 320,
        color: "zinc",
      });
      setActiveTool("select");
      return;
    }

    // 7. SELECT / PAN BACKGROUND
    if (
      e.target === containerRef.current ||
      (e.target as HTMLElement).dataset.canvasBg
    ) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedDrawingId(null);
      setConnectingFromId(null);
      setIsPanning(true);
      isPanningRef.current = true;
      setPanStart({ x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y });
    }
  }, [activeTool, canWrite, addNode, addGroup, getCanvasCoordinates]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Live Freehand Drawing
    if (isDrawingRef.current && currentStrokeRef.current && canWrite) {
      const { x: canvasX, y: canvasY } = getCanvasCoordinates(e.clientX, e.clientY);
      const stroke = currentStrokeRef.current;
      stroke.points.push({ x: canvasX, y: canvasY });

      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (currentStrokeRef.current) {
            setCurrentStroke({ ...currentStrokeRef.current });
          }
        });
      }
      return;
    }

    // 2. Canvas Panning (Smooth local transform without CRDT spam)
    if (isPanningRef.current) {
      const nextPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
      setPan(nextPan);
      panRef.current = nextPan;
      updateViewportTransform();
    }
    // 3. Node Dragging (Smooth local positioning, commits on pointer up)
    else if (draggedNodeRef.current && canWrite) {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      const newX = coords.x - dragOffset.x;
      const newY = coords.y - dragOffset.y;
      const next = { id: draggedNodeRef.current.id, x: newX, y: newY };
      draggedNodeRef.current = next;
      setDraggedNode(next);
    }
    // 4. Group Dragging
    else if (draggedGroupRef.current && canWrite) {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      const newX = coords.x - groupDragOffsetRef.current.x;
      const newY = coords.y - groupDragOffsetRef.current.y;
      const next = { id: draggedGroupRef.current.id, x: newX, y: newY };
      draggedGroupRef.current = next;
      setDraggedGroup(next);
    }
    // 5. Drawing Dragging
    else if (draggedDrawingRef.current && canWrite) {
      const coords = getCanvasCoordinates(e.clientX, e.clientY);
      const newX = coords.x - drawingDragOffsetRef.current.x;
      const newY = coords.y - drawingDragOffsetRef.current.y;
      const next = { id: draggedDrawingRef.current.id, x: newX, y: newY };
      draggedDrawingRef.current = next;
      setDraggedDrawing(next);
    }
  }, [canWrite, getCanvasCoordinates]);

  const handleCanvasPointerUp = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    setIsPointerDown(false);

    if (e?.currentTarget && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    // Release pointer capture from any element that might have it
    if (e?.pointerId) {
      try {
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement?.hasPointerCapture?.(e.pointerId)) {
          activeElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }

    // Commit completed freehand stroke to Yjs CRDT
    if (isDrawingRef.current && canWrite) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      const stroke = currentStrokeRef.current;
      if (stroke && stroke.points.length > 1) {
        const first = stroke.points[0];
        const hasMoved = stroke.points.some(
          (p) => Math.hypot(p.x - first.x, p.y - first.y) > 3,
        );
        if (hasMoved) {
          addDrawing(stroke);
        }
      }
      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      setIsDrawing(false);
      setCurrentStroke(null);
    }

    // Commit finished pan to CRDT viewport
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      setViewport({ ...panRef.current, zoom: zoomRef.current });
    }

    // Commit finished node drag to CRDT
    if (draggedNodeRef.current && canWrite) {
      const { id, x, y } = draggedNodeRef.current;
      updateNode(id, { x, y });
      draggedNodeRef.current = null;
      setDraggedNode(null);
    }

    // Commit finished group drag to CRDT
    if (draggedGroupRef.current && canWrite) {
      const { id, x, y } = draggedGroupRef.current;
      updateGroup(id, { x, y });
      draggedGroupRef.current = null;
      setDraggedGroup(null);
    }

    // Commit finished drawing drag to CRDT
    if (draggedDrawingRef.current && canWrite) {
      const { id, x, y } = draggedDrawingRef.current;
      const drawing = drawingsRef.current?.find((d) => d.id === id);
      if (drawing) {
        const dx = x - drawing.points[0].x;
        const dy = y - drawing.points[0].y;
        const updatedPoints = drawing.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        const updated = { ...drawing, points: updatedPoints };
        deleteDrawing(id);
        addDrawing(updated);
      }
      draggedDrawingRef.current = null;
      setDraggedDrawing(null);
    }
  }, [canWrite, updateNode, updateGroup, deleteDrawing, addDrawing, setViewport]);

  const handleCanvasPointerCancel = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    setIsPointerDown(false);

    if (e?.currentTarget && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (isDrawingRef.current) {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      setIsDrawing(false);
      setCurrentStroke(null);
    }

    isPanningRef.current = false;
    setIsPanning(false);
    draggedNodeRef.current = null;
    setDraggedNode(null);
    draggedGroupRef.current = null;
    setDraggedGroup(null);
    draggedDrawingRef.current = null;
    setDraggedDrawing(null);
  }, []);

  // Node Drag Start & Eraser/Connect interaction
  const handleNodeMouseDown = useCallback(
    (e: React.PointerEvent, node: SystemNode) => {
      e.stopPropagation();

      if (activeTool === "eraser" && canWrite) {
        deleteNode(node.id);
        return;
      }

      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setSelectedDrawingId(null);

      if (activeTool === "connect") {
        if (!connectingFromId) {
          setConnectingFromId(node.id);
        } else if (connectingFromId !== node.id) {
          addEdge({
            id: `edge-${Date.now()}`,
            from: connectingFromId,
            to: node.id,
            label: "HTTPS / REST",
            style: "solid",
            arrow: "single",
          });
          setConnectingFromId(null);
          setActiveTool("select");
        }
        return;
      }

      if (canWrite) {
        const coords = getCanvasCoordinates(e.clientX, e.clientY);
        const dragInfo = { id: node.id, x: node.x, y: node.y };
        draggedNodeRef.current = dragInfo;
        setDraggedNode(dragInfo);
        setDragOffset({ x: coords.x - node.x, y: coords.y - node.y });
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Fallback if pointer capture is unavailable
        }
      }
    },
    [
      activeTool,
      canWrite,
      connectingFromId,
      deleteNode,
      addEdge,
      getCanvasCoordinates,
    ],
  );

  const handleConnectClick = useCallback(
    (nodeId: string) => {
      if (!connectingFromId) {
        setConnectingFromId(nodeId);
      } else if (connectingFromId !== nodeId) {
        addEdge({
          id: `edge-${Date.now()}`,
          from: connectingFromId,
          to: nodeId,
          label: "gRPC",
          style: "solid",
          arrow: "single",
        });
        setConnectingFromId(null);
      }
    },
    [connectingFromId, addEdge],
  );

  const handleEdgeClick = useCallback(
    (e: React.MouseEvent, edgeId: string) => {
      e.stopPropagation();
      if (activeTool === "eraser" && canWrite) {
        deleteEdge(edgeId);
      } else {
        setSelectedEdgeId(edgeId);
        setSelectedNodeId(null);
        setSelectedDrawingId(null);
      }
    },
    [activeTool, canWrite, deleteEdge],
  );

  const handleEdgePointerEnter = useCallback(
    (edgeId: string) => {
      if (activeTool === "eraser" && isPointerDown && canWrite) {
        deleteEdge(edgeId);
      }
    },
    [activeTool, isPointerDown, canWrite, deleteEdge],
  );

  const handleDrawingClick = useCallback(
    (e: React.PointerEvent, id: string) => {
      e.stopPropagation();
      if (activeTool === "eraser" && canWrite) {
        deleteDrawing(id);
      } else if (activeTool === "select" && canWrite) {
        setSelectedDrawingId(id);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        const drawing = diagram.drawings?.find((d) => d.id === id);
        if (drawing && drawing.points.length > 0) {
          const coords = getCanvasCoordinates(e.clientX, e.clientY);
          draggedDrawingRef.current = { id, x: drawing.points[0].x, y: drawing.points[0].y };
          setDraggedDrawing(draggedDrawingRef.current);
          drawingDragOffsetRef.current = { x: coords.x - drawing.points[0].x, y: coords.y - drawing.points[0].y };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Fallback
          }
        }
      } else {
        setSelectedDrawingId(id);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
      }
    },
    [activeTool, canWrite, deleteDrawing, getCanvasCoordinates, diagram.drawings],
  );

  const handleDrawingPointerEnter = useCallback(
    (id: string) => {
      if (activeTool === "eraser" && isPointerDown && canWrite) {
        deleteDrawing(id);
      }
    },
    [activeTool, isPointerDown, canWrite, deleteDrawing],
  );

  const handleGroupClick = useCallback(
    (e: React.PointerEvent, groupId: string) => {
      e.stopPropagation();
      if (activeTool === "eraser" && canWrite) {
        deleteGroup(groupId);
      } else if (activeTool === "select" && canWrite) {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setSelectedDrawingId(null);
        const group = diagram.groups.find((g) => g.id === groupId);
        if (group) {
          const coords = getCanvasCoordinates(e.clientX, e.clientY);
          draggedGroupRef.current = { id: groupId, x: group.x, y: group.y };
          setDraggedGroup(draggedGroupRef.current);
          groupDragOffsetRef.current = { x: coords.x - group.x, y: coords.y - group.y };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Fallback
          }
        }
      }
    },
    [activeTool, canWrite, deleteGroup, getCanvasCoordinates, diagram.groups],
  );

  // Add Component Helpers
  const handleAddService = (type: NodeType = "service") => {
    if (!canWrite) return;
    const id = `node-${Date.now()}`;
    const x = Math.round((300 - panRef.current.x) / zoomRef.current);
    const y = Math.round((200 - panRef.current.y) / zoomRef.current);

    const labels: Record<
      NodeType,
      { label: string; sublabel: string; color: SystemNode["color"] }
    > = {
      service: {
        label: "Microservice Worker",
        sublabel: "Node.js / Express",
        color: "violet",
      },
      database: {
        label: "PostgreSQL Database",
        sublabel: "Primary ACID Store",
        color: "emerald",
      },
      queue: {
        label: "Kafka Event Broker",
        sublabel: "Topics: events, tasks",
        color: "amber",
      },
      storage: {
        label: "S3 Object Storage",
        sublabel: "Blobs & Media Store",
        color: "cyan",
      },
      gateway: {
        label: "API Gateway",
        sublabel: "TLS & Reverse Proxy",
        color: "blue",
      },
      client: {
        label: "Web Client",
        sublabel: "Next.js Application",
        color: "zinc",
      },
      cloud: {
        label: "Cloud Service",
        sublabel: "Managed Cloud Provider",
        color: "rose",
      },
      container: {
        label: "Docker Container",
        sublabel: "K8s Pod",
        color: "blue",
      },
      text: {
        label: "Architecture Note",
        sublabel: "Design annotation",
        color: "zinc",
      },
      rectangle: {
        label: "Service Block",
        sublabel: "Process Component",
        color: "violet",
      },
      circle: {
        label: "State Store",
        sublabel: "Distributed Cache",
        color: "emerald",
      },
    };

    const cfg = labels[type] ?? labels.service;
    addNode({
      id,
      type,
      label: cfg.label,
      sublabel: cfg.sublabel,
      technology: type.toUpperCase(),
      color: cfg.color,
      x,
      y,
      width: 220,
      height: 85,
    });
    setSelectedNodeId(id);
    setInsertMenuOpen(false);
  };

  // Auto-Layout Algorithm
  const handleAutoLayout = () => {
    if (!canWrite) return;
    const nodes = [...diagram.nodes];
    if (nodes.length === 0) return;

    const tiers: Record<string, SystemNode[]> = {
      client: [],
      gateway: [],
      service: [],
      queue: [],
      database: [],
    };

    nodes.forEach((n) => {
      if (n.type === "client") tiers.client.push(n);
      else if (n.type === "gateway") tiers.gateway.push(n);
      else if (n.type === "service" || n.type === "rectangle")
        tiers.service.push(n);
      else if (n.type === "queue") tiers.queue.push(n);
      else tiers.database.push(n);
    });

    const tierOrder = ["client", "gateway", "service", "queue", "database"];
    const startX = 80;
    const startY = 100;
    const colWidth = 280;
    const rowHeight = 130;

    let colIndex = 0;
    tierOrder.forEach((tier) => {
      const tierNodes = tiers[tier];
      if (tierNodes && tierNodes.length > 0) {
        tierNodes.forEach((n, rowIndex) => {
          updateNode(n.id, {
            x: startX + colIndex * colWidth,
            y: startY + rowIndex * rowHeight,
          });
        });
        colIndex++;
      }
    });
  };

  return (
    <div
      ref={containerRef}
      data-canvas-bg="true"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerCancel}
      onLostPointerCapture={handleCanvasPointerCancel}
      onPointerLeave={(e) => {
        if (!isDrawingRef.current && !draggedNodeRef.current && !draggedGroupRef.current && !draggedDrawingRef.current) {
          handleCanvasPointerUp(e);
        }
      }}
      onWheel={handleWheel}
      className={cn(
        "absolute inset-0 select-none overflow-hidden bg-canvas-bg",
        activeTool === "draw" && "cursor-crosshair",
        activeTool === "eraser" && "cursor-cell",
        activeTool === "rectangle" && "cursor-crosshair",
        activeTool === "circle" && "cursor-crosshair",
        activeTool === "text" && "cursor-text",
        activeTool === "select" &&
          (isPanning ? "cursor-grabbing" : "cursor-default"),
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(var(--canvas-grid) 1.2px, transparent 1.2px)`,
        backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* ── Left Floating Toolbar ────────────────────────────────────────── */}
      <CanvasToolbar
        activeTool={activeTool}
        canWrite={canWrite}
        insertMenuOpen={insertMenuOpen}
        onToggleInsertMenu={() => setInsertMenuOpen(!insertMenuOpen)}
        onAddService={handleAddService}
        onOpenAiModal={() => setAiModalOpen(true)}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          if (tool === "connect") setConnectingFromId(null);
        }}
        onAutoLayout={handleAutoLayout}
      />

      {/* ── Floating Sub-Palette for Draw Tool ────────────────────────────── */}
      {activeTool === "draw" && (
        <CanvasDrawSubPalette
          drawMode={drawMode}
          drawColor={drawColor}
          drawWidth={drawWidth}
          hasDrawings={(diagram.drawings?.length ?? 0) > 0}
          onSetDrawMode={setDrawMode}
          onSetDrawColor={setDrawColor}
          onSetDrawWidth={setDrawWidth}
          onClearDrawings={clearDrawings}
        />
      )}

      {/* ── Active Eraser Tool Notice ────────────────────────────────────── */}
      {activeTool === "eraser" && (
        <div className="absolute top-4 left-18 z-30 flex items-center gap-2 rounded-2xl border border-destructive/50 bg-destructive/10 px-3.5 py-1.5 shadow-xl backdrop-blur-md">
          <Eraser className="size-4 text-destructive animate-pulse" />
          <span className="text-xs font-semibold text-destructive">
            Eraser Tool: Click or drag over items to erase them
          </span>
        </div>
      )}

      {/* ── Active Connect Tool Hint ────────────────────────────────────── */}
      {activeTool === "connect" && (
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-primary/50 bg-card/95 px-4 py-1.5 text-xs font-semibold text-primary shadow-xl backdrop-blur-md">
          {connectingFromId
            ? "Click target component to complete arrow connection"
            : "Click source component to start arrow connection"}
        </div>
      )}

      {/* ── Active Quick-Place Shape Hint ────────────────────────────────── */}
      {(activeTool === "rectangle" ||
        activeTool === "circle" ||
        activeTool === "text" ||
        activeTool === "group") && (
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-primary/50 bg-card/95 px-4 py-1.5 text-xs font-semibold text-primary shadow-xl backdrop-blur-md">
          Click anywhere on canvas to place {activeTool}
        </div>
      )}

      {/* ── Top-Right Header Bar ─────────────────────────────────────────── */}
      <CanvasHeaderControls
        zoom={zoom}
        diagram={diagram}
        templateMenuOpen={templateMenuOpen}
        onOpenAiModal={() => setAiModalOpen(true)}
        onToggleTemplateMenu={() => setTemplateMenuOpen(!templateMenuOpen)}
        onLoadTemplate={(key) => {
          loadTemplate(key);
          const tpl = SYSTEM_DESIGN_TEMPLATES[key];
          if (tpl) {
            const newPan = tpl.diagram.viewport ?? { x: 40, y: 40 };
            const newZoom = tpl.diagram.viewport?.zoom ?? 0.85;
            setPan(newPan);
            panRef.current = newPan;
            setZoom(newZoom);
            zoomRef.current = newZoom;
          }
          setTemplateMenuOpen(false);
        }}
        onExportSvg={() => exportDiagramAsSvg(diagram)}
        onZoomIn={() => {
          const rect = canvasRectRef.current;
          const cx = rect ? rect.left + rect.width / 2 : 0;
          const cy = rect ? rect.top + rect.height / 2 : 0;
          const next = Math.min(MAX_ZOOM, zoomRef.current * ZOOM_FACTOR);
          zoomAtPoint(next, cx, cy);
          persistViewport();
        }}
        onZoomOut={() => {
          const rect = canvasRectRef.current;
          const cx = rect ? rect.left + rect.width / 2 : 0;
          const cy = rect ? rect.top + rect.height / 2 : 0;
          const next = Math.max(MIN_ZOOM, zoomRef.current / ZOOM_FACTOR);
          zoomAtPoint(next, cx, cy);
          persistViewport();
        }}
        onResetZoom={() => {
          const rect = canvasRectRef.current;
          const cx = rect ? rect.left + rect.width / 2 : 0;
          const cy = rect ? rect.top + rect.height / 2 : 0;
          zoomAtPoint(1, cx, cy);
          persistViewport();
        }}
      />

      {/* ── Main Canvas Viewport (Transformed by pan & zoom) ─────────────── */}
      <div
        ref={viewportRef}
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Connectors & Freehand Drawings Layer */}
        <svg className="pointer-events-none absolute inset-0 h-[6000px] w-[6000px] overflow-visible">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 9 4.5, 0 9" fill="var(--canvas-edge)" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <polygon
                points="0 0, 9 4.5, 0 9"
                fill="var(--canvas-edge-selected)"
              />
            </marker>
          </defs>

          {/* 1. Freehand Manual Drawings (CRDT Synced) */}
          <CanvasDrawingsLayer
            drawings={diagram.drawings}
            selectedDrawingId={selectedDrawingId}
            activeTool={activeTool}
            canWrite={canWrite}
            draggedDrawing={draggedDrawing}
            onDrawingClick={handleDrawingClick}
            onDrawingPointerEnter={handleDrawingPointerEnter}
          />

          {/* 2. In-Progress Freehand Stroke (Live) */}
          <ActiveStrokeLayer currentStroke={currentStroke} draggedDrawing={draggedDrawing} />

          {/* 3. Connectors & Edges */}
          <CanvasEdgesLayer
            edges={diagram.edges}
            nodes={diagram.nodes}
            selectedEdgeId={selectedEdgeId}
            draggedNode={draggedNode}
            activeTool={activeTool}
            canWrite={canWrite}
            onEdgeClick={handleEdgeClick}
            onEdgePointerEnter={handleEdgePointerEnter}
          />
        </svg>

        {/* Groups / Containers Layer */}
        <CanvasGroupsLayer
          groups={diagram.groups}
          activeTool={activeTool}
          canWrite={canWrite}
          draggedGroup={draggedGroup}
          onGroupClick={handleGroupClick}
          onDeleteGroup={deleteGroup}
        />

        {/* Nodes Layer */}
        <CanvasNodesLayer
          nodes={diagram.nodes}
          selectedNodeId={selectedNodeId}
          connectingFromId={connectingFromId}
          draggedNode={draggedNode}
          activeTool={activeTool}
          canWrite={canWrite}
          onNodeMouseDown={handleNodeMouseDown}
          onDoubleClickNode={(node) => setEditingNode(node)}
          onConnectClick={handleConnectClick}
        />
      </div>

      {/* ── Node Edit Dialog ─────────────────────────────────────────────── */}
      {editingNode && (
        <NodeEditDialog
          editingNode={editingNode}
          onClose={() => setEditingNode(null)}
          onSave={(updated) => updateNode(updated.id, updated)}
          onDelete={(id) => {
            deleteNode(id);
            setSelectedNodeId(null);
          }}
        />
      )}

      {/* ── AI Diagram Generator Modal ───────────────────────────────────── */}
      <AiDiagramModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onApplyDiagram={(newDiagram) => {
          setFullDiagram(newDiagram);
          const newPan = newDiagram.viewport ?? { x: 40, y: 40 };
          const newZoom = newDiagram.viewport?.zoom ?? 0.85;
          setPan(newPan);
          panRef.current = newPan;
          setZoom(newZoom);
          zoomRef.current = newZoom;
        }}
      />
    </div>
  );
}
