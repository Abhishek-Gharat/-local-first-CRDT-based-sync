"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import * as Y from "yjs";
import {
  Server,
  Database,
  Layers,
  Cpu,
  Globe,
  HardDrive,
  Cloud,
  MessageSquare,
  Shield,
  ArrowRight,
  ArrowUpRight,
  Plus,
  Minus,
  Sparkles,
  RotateCcw,
  Download,
  LayoutGrid,
  Trash2,
  Edit3,
  MousePointer,
  Box,
  Pencil,
  Eraser,
  Square,
  Circle,
  Type,
  Check,
} from "lucide-react";
import {
  type SystemNode,
  type SystemEdge,
  type SystemGroup,
  type SystemDrawing,
  type NodeType,
  type NodeColor,
  type DiagramModel,
  SYSTEM_DESIGN_TEMPLATES,
} from "shared";
import { useDiagramCrdt } from "@/components/canvas/use-diagram-crdt";
import { AiDiagramModal } from "@/components/canvas/ai-diagram-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SystemDesignCanvasProps {
  doc: Y.Doc;
  canWrite?: boolean;
  className?: string;
}

export type CanvasTool =
  | "select"
  | "rectangle"
  | "circle"
  | "connect"
  | "draw"
  | "eraser"
  | "text"
  | "group";

const COLOR_MAP: Record<NodeColor, { border: string; bg: string; text: string; ring: string }> = {
  blue: { border: "border-sky-500/60", bg: "bg-sky-500/10", text: "text-sky-400", ring: "ring-sky-500/30" },
  emerald: { border: "border-emerald-500/60", bg: "bg-emerald-500/10", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  violet: { border: "border-violet-500/60", bg: "bg-violet-500/10", text: "text-violet-400", ring: "ring-violet-500/30" },
  amber: { border: "border-amber-500/60", bg: "bg-amber-500/10", text: "text-amber-400", ring: "ring-amber-500/30" },
  rose: { border: "border-rose-500/60", bg: "bg-rose-500/10", text: "text-rose-400", ring: "ring-rose-500/30" },
  cyan: { border: "border-cyan-500/60", bg: "bg-cyan-500/10", text: "text-cyan-400", ring: "ring-cyan-500/30" },
  zinc: { border: "border-zinc-700/80", bg: "bg-zinc-800/40", text: "text-zinc-300", ring: "ring-zinc-500/30" },
  orange: { border: "border-orange-500/60", bg: "bg-orange-500/10", text: "text-orange-400", ring: "ring-orange-500/30" },
};

const DRAW_PALETTE = [
  { color: "#f4f4f5", label: "White" },
  { color: "#a855f7", label: "Violet" },
  { color: "#38bdf8", label: "Sky" },
  { color: "#34d399", label: "Emerald" },
  { color: "#fbbf24", label: "Amber" },
  { color: "#f43f5e", label: "Rose" },
];

function getNodeIcon(type: NodeType) {
  switch (type) {
    case "database":
      return Database;
    case "queue":
      return MessageSquare;
    case "storage":
      return HardDrive;
    case "client":
      return Globe;
    case "gateway":
      return Shield;
    case "cloud":
      return Cloud;
    case "container":
      return Layers;
    case "circle":
      return Circle;
    case "rectangle":
      return Square;
    case "text":
      return Type;
    case "service":
    default:
      return Server;
  }
}

/**
 * Smooth quadratic Bezier curve conversion for freehand drawing strokes
 */
function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (!points || points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${xc} ${yc}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Exports diagram as a standalone SVG file
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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}" style="background:#090a0f;font-family:ui-sans-serif,system-ui,sans-serif;">\n`;
  svg += `  <defs>\n    <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">\n      <polygon points="0 0, 9 4.5, 0 9" fill="#94a3b8" />\n    </marker>\n  </defs>\n`;

  // Groups
  diagram.groups.forEach((g) => {
    svg += `  <rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" rx="16" fill="rgba(24,24,27,0.4)" stroke="#3f3f46" stroke-dasharray="6,6" stroke-width="2" />\n`;
    svg += `  <text x="${g.x + 16}" y="${g.y + 26}" fill="#e4e4e7" font-weight="700" font-size="12px">${g.label}</text>\n`;
  });

  // Drawings
  diagram.drawings?.forEach((d) => {
    const pathD = pointsToSvgPath(d.points);
    svg += `  <path d="${pathD}" fill="none" stroke="${d.color}" stroke-width="${d.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${d.tool === "highlighter" ? 0.45 : 1}" />\n`;
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
      svg += `  <path d="M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}" fill="none" stroke="#64748b" stroke-width="1.8" marker-end="url(#arrow)" />\n`;
      if (e.label) {
        svg += `  <text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" fill="#cbd5e1" font-size="11px" font-weight="600" text-anchor="middle">${e.label}</text>\n`;
      }
    }
  });

  // Nodes
  diagram.nodes.forEach((n) => {
    svg += `  <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="12" fill="#18181b" stroke="#38bdf8" stroke-width="1.5" />\n`;
    svg += `  <text x="${n.x + 14}" y="${n.y + 28}" fill="#ffffff" font-weight="700" font-size="13px">${n.label}</text>\n`;
    if (n.sublabel) {
      svg += `  <text x="${n.x + 14}" y="${n.y + 46}" fill="#94a3b8" font-size="10px">${n.sublabel}</text>\n`;
    }
    if (n.technology) {
      svg += `  <text x="${n.x + 14}" y="${n.y + 66}" fill="#64748b" font-family="monospace" font-size="9px">${n.technology}</text>\n`;
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
  const [zoom, setZoom] = useState(diagram.viewport?.zoom ?? 0.85);
  const [pan, setPan] = useState({ x: diagram.viewport?.x ?? 40, y: diagram.viewport?.y ?? 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

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

  // Freehand Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<SystemDrawing | null>(null);
  const [drawColor, setDrawColor] = useState<string>("#a855f7");
  const [drawWidth, setDrawWidth] = useState<number>(3);
  const [drawMode, setDrawMode] = useState<"pen" | "highlighter">("pen");
  const [isPointerDown, setIsPointerDown] = useState(false);

  // Dragging Node state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Keyboard Shortcuts (matching Eraser.io)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, selectedEdgeId, selectedDrawingId, canWrite, deleteNode, deleteEdge, deleteDrawing]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const nextZoom = Math.min(2, Math.max(0.25, zoom + delta));
      setZoom(nextZoom);
      setViewport({ ...pan, zoom: nextZoom });
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX * 0.8,
        y: prev.y - e.deltaY * 0.8,
      }));
    }
  };

  // Canvas Pointer Handlers (Draw, Erase, Pan, Place Shapes)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    setIsPointerDown(true);

    const canvasX = Math.round((e.clientX - pan.x) / zoom);
    const canvasY = Math.round((e.clientY - pan.y) / zoom);

    // 1. FREEHAND DRAW TOOL
    if (activeTool === "draw" && canWrite) {
      setIsDrawing(true);
      setCurrentStroke({
        id: `draw-${Date.now()}`,
        points: [{ x: canvasX, y: canvasY }],
        color: drawColor,
        strokeWidth: drawMode === "highlighter" ? 14 : drawWidth,
        tool: drawMode,
      });
      return;
    }

    // 2. ERASER TOOL: click on canvas does nothing or erases
    if (activeTool === "eraser") {
      return;
    }

    // 3. RECTANGLE TOOL (Eraser-style quick shape)
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
    if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setSelectedDrawingId(null);
      setConnectingFromId(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    // Live freehand drawing points
    if (isDrawing && currentStroke && canWrite) {
      const canvasX = Math.round((e.clientX - pan.x) / zoom);
      const canvasY = Math.round((e.clientY - pan.y) / zoom);
      setCurrentStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, { x: canvasX, y: canvasY }],
        };
      });
      return;
    }

    // Canvas panning
    if (isPanning) {
      const nextPan = { x: e.clientX - panStart.x, y: e.clientY - panStart.y };
      setPan(nextPan);
      setViewport({ ...nextPan, zoom });
    } else if (draggedNodeId && canWrite) {
      const node = diagram.nodes.find((n) => n.id === draggedNodeId);
      if (node) {
        const newX = Math.round((e.clientX - pan.x) / zoom - dragOffset.x);
        const newY = Math.round((e.clientY - pan.y) / zoom - dragOffset.y);
        updateNode(draggedNodeId, { x: newX, y: newY });
      }
    }
  };

  const handleCanvasPointerUp = () => {
    setIsPointerDown(false);

    // Commit completed freehand stroke to Yjs CRDT
    if (isDrawing && currentStroke && canWrite) {
      if (currentStroke.points.length > 1) {
        addDrawing(currentStroke);
      }
      setIsDrawing(false);
      setCurrentStroke(null);
    }

    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node Drag Start & Eraser/Connect interaction
  const handleNodeMouseDown = (e: React.MouseEvent, node: SystemNode) => {
    e.stopPropagation();

    // Eraser Tool deletes node directly
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
      setDraggedNodeId(node.id);
      const mouseCanvasX = (e.clientX - pan.x) / zoom;
      const mouseCanvasY = (e.clientY - pan.y) / zoom;
      setDragOffset({ x: mouseCanvasX - node.x, y: mouseCanvasY - node.y });
    }
  };

  // Add Component Helpers
  const handleAddService = (type: NodeType = "service") => {
    if (!canWrite) return;
    const id = `node-${Date.now()}`;
    const x = Math.round((300 - pan.x) / zoom);
    const y = Math.round((200 - pan.y) / zoom);

    const labels: Record<NodeType, { label: string; sublabel: string; color: NodeColor }> = {
      service: { label: "Microservice Worker", sublabel: "Node.js / Express", color: "violet" },
      database: { label: "PostgreSQL Database", sublabel: "Primary ACID Store", color: "emerald" },
      queue: { label: "Kafka Event Broker", sublabel: "Topics: events, tasks", color: "amber" },
      storage: { label: "S3 Object Storage", sublabel: "Blobs & Media Store", color: "cyan" },
      gateway: { label: "API Gateway", sublabel: "TLS & Reverse Proxy", color: "blue" },
      client: { label: "Web Client", sublabel: "Next.js Application", color: "zinc" },
      cloud: { label: "Cloud Service", sublabel: "Managed Cloud Provider", color: "rose" },
      container: { label: "Docker Container", sublabel: "K8s Pod", color: "blue" },
      text: { label: "Architecture Note", sublabel: "Design annotation", color: "zinc" },
      rectangle: { label: "Service Block", sublabel: "Process Component", color: "violet" },
      circle: { label: "State Store", sublabel: "Distributed Cache", color: "emerald" },
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
      else if (n.type === "service" || n.type === "rectangle") tiers.service.push(n);
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
      onPointerLeave={handleCanvasPointerUp}
      onWheel={handleWheel}
      className={cn(
        "relative h-full w-full select-none overflow-hidden bg-[#090a0f]",
        activeTool === "draw" && "cursor-crosshair",
        activeTool === "eraser" && "cursor-cell",
        activeTool === "rectangle" && "cursor-crosshair",
        activeTool === "circle" && "cursor-crosshair",
        activeTool === "text" && "cursor-text",
        activeTool === "select" && (isPanning ? "cursor-grabbing" : "cursor-default"),
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
        backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* ── Left Floating Eraser-Style Tool Palette (Exact Eraser.io matching) ── */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md">
        {/* + Insert Menu */}
        <div className="relative">
          <button
            type="button"
            title="Insert Architecture Component (J)"
            onClick={() => setInsertMenuOpen(!insertMenuOpen)}
            className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <Plus className="size-4.5" />
          </button>

          {insertMenuOpen && (
            <div className="absolute top-0 left-12 z-50 flex w-64 flex-col rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md">
              <p className="px-2 py-1 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                Add Architecture Component
              </p>
              <button
                type="button"
                onClick={() => handleAddService("service")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Server className="size-4 text-violet-400" />
                <span>Microservice Worker</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddService("database")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Database className="size-4 text-emerald-400" />
                <span>PostgreSQL / Database</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddService("queue")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <MessageSquare className="size-4 text-amber-400" />
                <span>Kafka Event Broker</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddService("storage")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <HardDrive className="size-4 text-cyan-400" />
                <span>S3 Storage / Bucket</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddService("gateway")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Shield className="size-4 text-sky-400" />
                <span>API Gateway / Proxy</span>
              </button>
              <button
                type="button"
                onClick={() => handleAddService("client")}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <Globe className="size-4 text-zinc-400" />
                <span>Web / Mobile Client</span>
              </button>
            </div>
          )}
        </div>

        {/* Eraser AI */}
        <button
          type="button"
          title="Eraser AI: Generate System Design (Ctrl+J)"
          onClick={() => setAiModalOpen(true)}
          className="flex size-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 transition-colors hover:bg-violet-600 hover:text-white"
        >
          <Sparkles className="size-4.5" />
        </button>

        <span className="my-1 h-px w-full bg-zinc-800" />

        {/* Select / Move Tool (V) */}
        <button
          type="button"
          title="Select / Move Tool (V)"
          onClick={() => setActiveTool("select")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "select" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <MousePointer className="size-4.5" />
        </button>

        {/* Rectangle Shape Tool (R) */}
        <button
          type="button"
          title="Rectangle / Service Shape (R)"
          onClick={() => setActiveTool("rectangle")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "rectangle" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <Square className="size-4.5" />
        </button>

        {/* Circle / Database Shape Tool (O) */}
        <button
          type="button"
          title="Circle / Database Shape (O)"
          onClick={() => setActiveTool("circle")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "circle" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <Circle className="size-4.5" />
        </button>

        {/* Connector Arrow Tool (A / C) */}
        <button
          type="button"
          title="Connect Components with Arrow (A or C)"
          onClick={() => {
            setActiveTool("connect");
            setConnectingFromId(null);
          }}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "connect" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <ArrowUpRight className="size-4.5" />
        </button>

        {/* Manual Draw / Pen Tool (P or D) */}
        <button
          type="button"
          title="Draw / Pen Tool (P or D) - Sketch manually"
          onClick={() => setActiveTool("draw")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "draw" && "bg-violet-600 text-white hover:bg-violet-600 shadow-md",
          )}
        >
          <Pencil className="size-4.5" />
        </button>

        {/* Eraser Tool (E) */}
        <button
          type="button"
          title="Eraser Tool (E) - Click or swipe to erase drawings and items"
          onClick={() => setActiveTool("eraser")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "eraser" && "bg-rose-600 text-white hover:bg-rose-600 shadow-md animate-pulse",
          )}
        >
          <Eraser className="size-4.5" />
        </button>

        {/* Text / Note Tool (T) */}
        <button
          type="button"
          title="Text Note / Sticky (T)"
          onClick={() => setActiveTool("text")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "text" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <Type className="size-4.5" />
        </button>

        {/* Container / Subnet Frame (F) */}
        <button
          type="button"
          title="Architecture Container / Subnet Boundary (F)"
          onClick={() => setActiveTool("group")}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "group" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <Box className="size-4.5" />
        </button>

        <span className="my-1 h-px w-full bg-zinc-800" />

        {/* Auto Layout */}
        <button
          type="button"
          title="Auto Layout Diagram"
          onClick={handleAutoLayout}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <LayoutGrid className="size-4.5" />
        </button>
      </div>

      {/* ── Floating Sub-Palette for Draw Tool (Colors, Stroke Width, Mode) ─ */}
      {activeTool === "draw" && (
        <div className="absolute top-4 left-18 z-30 flex items-center gap-2 rounded-2xl border border-zinc-800/90 bg-zinc-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-md">
          {/* Pen vs Highlighter */}
          <div className="flex items-center rounded-xl bg-zinc-800/80 p-0.5">
            <button
              type="button"
              onClick={() => setDrawMode("pen")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                drawMode === "pen"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              Pen
            </button>
            <button
              type="button"
              onClick={() => setDrawMode("highlighter")}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                drawMode === "highlighter"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              Highlighter
            </button>
          </div>

          <span className="h-4 w-px bg-zinc-700/80" />

          {/* Color Swatches */}
          <div className="flex items-center gap-1.5">
            {DRAW_PALETTE.map((c) => (
              <button
                key={c.color}
                type="button"
                title={c.label}
                onClick={() => setDrawColor(c.color)}
                className={cn(
                  "size-5.5 rounded-full border border-black/40 transition-transform hover:scale-115",
                  drawColor === c.color && "scale-115 ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900",
                )}
                style={{ backgroundColor: c.color }}
              />
            ))}
          </div>

          <span className="h-4 w-px bg-zinc-700/80" />

          {/* Stroke Widths */}
          <div className="flex items-center gap-1">
            {[
              { w: 2, label: "Fine" },
              { w: 4, label: "Medium" },
              { w: 7, label: "Bold" },
            ].map((item) => (
              <button
                key={item.w}
                type="button"
                title={item.label}
                onClick={() => setDrawWidth(item.w)}
                className={cn(
                  "flex size-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                  drawWidth === item.w
                    ? "bg-zinc-700 text-white shadow-xs"
                    : "text-zinc-400 hover:bg-zinc-800/80 hover:text-white",
                )}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: item.w * 1.5, height: item.w * 1.5 }}
                />
              </button>
            ))}
          </div>

          {(diagram.drawings?.length ?? 0) > 0 && (
            <>
              <span className="h-4 w-px bg-zinc-700/80" />
              <button
                type="button"
                title="Clear all manual drawings"
                onClick={clearDrawings}
                className="flex size-7 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/20"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Active Eraser Tool Notice ────────────────────────────────────── */}
      {activeTool === "eraser" && (
        <div className="absolute top-4 left-18 z-30 flex items-center gap-2 rounded-2xl border border-rose-500/50 bg-rose-950/80 px-3.5 py-1.5 shadow-2xl backdrop-blur-md">
          <Eraser className="size-4 text-rose-300 animate-pulse" />
          <span className="text-xs font-semibold text-rose-200">
            Eraser Tool: Click or drag over drawings, connectors, or components to erase them
          </span>
        </div>
      )}

      {/* ── Active Connect Tool Hint ────────────────────────────────────── */}
      {activeTool === "connect" && (
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-violet-500/50 bg-violet-950/90 px-4 py-1.5 text-xs font-semibold text-violet-200 shadow-2xl backdrop-blur-md">
          {connectingFromId
            ? "Click target component to complete arrow connection"
            : "Click source component to start arrow connection"}
        </div>
      )}

      {/* ── Active Quick-Place Shape Hint ────────────────────────────────── */}
      {(activeTool === "rectangle" || activeTool === "circle" || activeTool === "text" || activeTool === "group") && (
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-sky-500/50 bg-sky-950/90 px-4 py-1.5 text-xs font-semibold text-sky-200 shadow-2xl backdrop-blur-md">
          Click anywhere on canvas to place {activeTool}
        </div>
      )}

      {/* ── Top-Right Header Bar: AI Generator, Templates & Zoom Controls ──── */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
        <Button
          onClick={() => setAiModalOpen(true)}
          size="sm"
          className="h-9 gap-1.5 rounded-xl bg-violet-600 px-3.5 font-semibold text-white shadow-lg transition-transform hover:bg-violet-500 active:scale-95"
        >
          <Sparkles className="size-4" />
          Eraser AI
        </Button>

        {/* Templates Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTemplateMenuOpen(!templateMenuOpen)}
            className="h-9 gap-1.5 rounded-xl border-zinc-800 bg-zinc-900/90 text-xs font-semibold text-zinc-300 shadow-lg backdrop-blur-md hover:bg-zinc-800 hover:text-white"
          >
            <Layers className="size-3.5" />
            Templates
          </Button>

          {templateMenuOpen && (
            <div className="absolute top-11 right-0 z-50 flex w-72 flex-col rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-md">
              <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
                System Design Presets
              </p>
              {Object.entries(SYSTEM_DESIGN_TEMPLATES).map(([key, tpl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    loadTemplate(key as keyof typeof SYSTEM_DESIGN_TEMPLATES);
                    setTemplateMenuOpen(false);
                  }}
                  className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-zinc-800/80"
                >
                  <span className="text-xs font-semibold text-white">{tpl.name}</span>
                  <span className="mt-0.5 line-clamp-1 text-[11px] text-zinc-400">
                    {tpl.description}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export SVG */}
        <Button
          variant="outline"
          size="sm"
          title="Export Architecture Diagram as SVG"
          onClick={() => exportDiagramAsSvg(diagram)}
          className="h-9 gap-1.5 rounded-xl border-zinc-800 bg-zinc-900/90 text-xs font-semibold text-zinc-300 shadow-lg backdrop-blur-md hover:bg-zinc-800 hover:text-white"
        >
          <Download className="size-3.5" />
          Export
        </Button>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800/90 bg-zinc-900/90 p-1 shadow-lg backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              const next = Math.max(0.25, zoom - 0.1);
              setZoom(next);
              setViewport({ ...pan, zoom: next });
            }}
            aria-label="Zoom out"
            className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="w-12 text-center font-mono text-xs font-semibold text-zinc-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              const next = Math.min(2, zoom + 0.1);
              setZoom(next);
              setViewport({ ...pan, zoom: next });
            }}
            aria-label="Zoom in"
            className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <Plus className="size-3.5" />
          </button>
          <button
            type="button"
            title="Reset Zoom to 100%"
            onClick={() => {
              setZoom(1);
              setViewport({ ...pan, zoom: 1 });
            }}
            className="flex size-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Main Canvas Viewport (Transformed by pan & zoom) ─────────────── */}
      <div
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
              <polygon points="0 0, 9 4.5, 0 9" fill="#94a3b8" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 9 4.5, 0 9" fill="#818cf8" />
            </marker>
          </defs>

          {/* 1. Freehand Manual Drawings (CRDT Synced) */}
          {diagram.drawings?.map((drawing) => {
            const pathD = pointsToSvgPath(drawing.points);
            const isSelected = selectedDrawingId === drawing.id;
            return (
              <g
                key={drawing.id}
                className={cn(
                  "pointer-events-auto cursor-pointer transition-opacity",
                  activeTool === "eraser" && "hover:opacity-30",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === "eraser" && canWrite) {
                    deleteDrawing(drawing.id);
                  } else {
                    setSelectedDrawingId(drawing.id);
                    setSelectedNodeId(null);
                    setSelectedEdgeId(null);
                  }
                }}
                onPointerEnter={() => {
                  if (activeTool === "eraser" && isPointerDown && canWrite) {
                    deleteDrawing(drawing.id);
                  }
                }}
              >
                {/* Thick hit target for easy clicking and erasing */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(24, drawing.strokeWidth * 4)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Visible stroke */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={isSelected ? "#818cf8" : drawing.color}
                  strokeWidth={drawing.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={drawing.tool === "highlighter" ? 0.45 : 1}
                />
              </g>
            );
          })}

          {/* 2. In-Progress Freehand Stroke (Live) */}
          {currentStroke && (
            <path
              d={pointsToSvgPath(currentStroke.points)}
              fill="none"
              stroke={currentStroke.color}
              strokeWidth={currentStroke.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={currentStroke.tool === "highlighter" ? 0.45 : 1}
            />
          )}

          {/* 3. Connectors & Edges */}
          {diagram.edges.map((edge) => {
            const fromNode = diagram.nodes.find((n) => n.id === edge.from);
            const toNode = diagram.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const x1 = fromNode.x + fromNode.width / 2;
            const y1 = fromNode.y + fromNode.height / 2;
            const x2 = toNode.x + toNode.width / 2;
            const y2 = toNode.y + toNode.height / 2;

            const dx = x2 - x1;
            const dy = y2 - y1;
            const cx1 = x1 + dx * 0.45;
            const cy1 = y1;
            const cx2 = x1 + dx * 0.55;
            const cy2 = y2;
            const pathData = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const isSelected = selectedEdgeId === edge.id;

            return (
              <g
                key={edge.id}
                className={cn(
                  "pointer-events-auto cursor-pointer",
                  activeTool === "eraser" && "hover:opacity-30",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTool === "eraser" && canWrite) {
                    deleteEdge(edge.id);
                  } else {
                    setSelectedEdgeId(edge.id);
                    setSelectedNodeId(null);
                    setSelectedDrawingId(null);
                  }
                }}
                onPointerEnter={() => {
                  if (activeTool === "eraser" && isPointerDown && canWrite) {
                    deleteEdge(edge.id);
                  }
                }}
              >
                {/* Thick invisible hit target for easier clicking */}
                <path
                  d={pathData}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="20"
                />
                {/* Visible line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={isSelected ? "#818cf8" : "#64748b"}
                  strokeWidth={isSelected ? "2.5" : "1.8"}
                  strokeDasharray={
                    edge.style === "dashed"
                      ? "6,6"
                      : edge.style === "dotted"
                        ? "3,3"
                        : undefined
                  }
                  markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                  className="transition-colors"
                />
                {/* Label badge */}
                {edge.label && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-(edge.label.length * 4.2 + 8)}
                      y="-11"
                      width={edge.label.length * 8.4 + 16}
                      height="22"
                      rx="6"
                      fill="#18181b"
                      stroke={isSelected ? "#818cf8" : "#3f3f46"}
                      strokeWidth="1"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill={isSelected ? "#c7d2fe" : "#a1a1aa"}
                      fontSize="10.5"
                      fontWeight="600"
                      fontFamily="sans-serif"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Groups / Containers Layer */}
        {diagram.groups.map((group) => {
          const colorCfg = COLOR_MAP[group.color] ?? COLOR_MAP.zinc;
          return (
            <div
              key={group.id}
              onClick={(e) => {
                if (activeTool === "eraser" && canWrite) {
                  e.stopPropagation();
                  deleteGroup(group.id);
                }
              }}
              style={{
                transform: `translate(${group.x}px, ${group.y}px)`,
                width: `${group.width}px`,
                height: `${group.height}px`,
              }}
              className={cn(
                "group/grp absolute rounded-2xl border-2 border-dashed bg-zinc-950/40 p-3 transition-colors",
                colorCfg.border,
                activeTool === "eraser" && "hover:border-rose-500 hover:bg-rose-950/20 cursor-cell",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-xs font-bold tracking-tight text-zinc-200 shadow-md">
                  <Box className="size-3.5 text-zinc-400" />
                  {group.label}
                </span>
                {canWrite && (
                  <button
                    type="button"
                    title="Delete group"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteGroup(group.id);
                    }}
                    className="rounded p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-800 hover:text-rose-400 group-hover/grp:opacity-100"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Nodes Layer */}
        {diagram.nodes.map((node) => {
          const Icon = getNodeIcon(node.type);
          const colorCfg = COLOR_MAP[node.color] ?? COLOR_MAP.blue;
          const isSelected = selectedNodeId === node.id;
          const isConnectingSource = connectingFromId === node.id;

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onDoubleClick={() => setEditingNode(node)}
              style={{
                transform: `translate(${node.x}px, ${node.y}px)`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              className={cn(
                "group/node absolute flex cursor-grab flex-col justify-between rounded-xl border bg-zinc-900/95 p-3 shadow-xl backdrop-blur-md transition-all active:cursor-grabbing",
                colorCfg.border,
                isSelected && `ring-2 ${colorCfg.ring} border-white shadow-2xl`,
                isConnectingSource && "ring-3 ring-violet-500 border-violet-400 animate-pulse",
                activeTool === "eraser" && "hover:border-rose-500 hover:bg-rose-950/40 cursor-cell",
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-lg",
                      colorCfg.bg,
                      colorCfg.text,
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold tracking-tight text-white">
                      {node.label}
                    </p>
                    {node.sublabel && (
                      <p className="truncate text-[10px] font-medium text-zinc-400">
                        {node.sublabel}
                      </p>
                    )}
                  </div>
                </div>

                {node.technology && (
                  <span className="shrink-0 rounded border border-zinc-800 bg-zinc-950/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-zinc-400">
                    {node.technology}
                  </span>
                )}
              </div>

              {/* Status footer */}
              <div className="mt-auto flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[9.5px] text-zinc-500">
                <span className="capitalize">{node.type}</span>
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              </div>

              {/* Connector dot indicator for connecting mode */}
              <div
                title="Connect"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!connectingFromId) {
                    setConnectingFromId(node.id);
                  } else if (connectingFromId !== node.id) {
                    addEdge({
                      id: `edge-${Date.now()}`,
                      from: connectingFromId,
                      to: node.id,
                      label: "gRPC",
                      style: "solid",
                      arrow: "single",
                    });
                    setConnectingFromId(null);
                  }
                }}
                className={cn(
                  "absolute -right-1.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-zinc-600 transition-all hover:scale-125 hover:bg-violet-400",
                  isSelected && "bg-primary scale-110",
                  isConnectingSource && "bg-violet-400 scale-125",
                )}
              />
            </div>
          );
        })}
      </div>

      {/* ── Node Edit Dialog ─────────────────────────────────────────────── */}
      {editingNode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          onClick={() => setEditingNode(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Edit Component</h3>
              <button
                onClick={() => setEditingNode(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Component Label
                </label>
                <Input
                  value={editingNode.label}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, label: e.target.value })
                  }
                  className="mt-1 border-zinc-700 bg-zinc-950 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Subtitle / Description
                </label>
                <Input
                  value={editingNode.sublabel ?? ""}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, sublabel: e.target.value })
                  }
                  className="mt-1 border-zinc-700 bg-zinc-950 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Technology / Protocol
                </label>
                <Input
                  value={editingNode.technology ?? ""}
                  onChange={(e) =>
                    setEditingNode({ ...editingNode, technology: e.target.value })
                  }
                  placeholder="e.g. PostgreSQL 16, Kafka, gRPC"
                  className="mt-1 border-zinc-700 bg-zinc-950 text-white"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 uppercase">
                  Accent Color
                </label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {(["blue", "violet", "emerald", "amber", "rose", "cyan", "zinc"] as NodeColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingNode({ ...editingNode, color: c })}
                      className={cn(
                        "size-7 rounded-lg border border-white/20 capitalize",
                        COLOR_MAP[c].bg,
                        editingNode.color === c && "ring-2 ring-white",
                      )}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between border-t border-zinc-800 pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  deleteNode(editingNode.id);
                  setEditingNode(null);
                  setSelectedNodeId(null);
                }}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingNode(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    updateNode(editingNode.id, editingNode);
                    setEditingNode(null);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Diagram Generator Modal ───────────────────────────────────── */}
      <AiDiagramModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onApplyDiagram={(newDiagram) => {
          setFullDiagram(newDiagram);
          setPan(newDiagram.viewport ?? { x: 40, y: 40 });
          setZoom(newDiagram.viewport?.zoom ?? 0.85);
        }}
      />
    </div>
  );
}
