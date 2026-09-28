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
  Move,
  Plus,
  Minus,
  Sparkles,
  Maximize2,
  RotateCcw,
  Download,
  LayoutGrid,
  Trash2,
  Edit3,
  MousePointer,
  Box,
  Share2,
} from "lucide-react";
import {
  type SystemNode,
  type SystemEdge,
  type SystemGroup,
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
    case "service":
    default:
      return Server;
  }
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
    setViewport,
    setFullDiagram,
    loadTemplate,
  } = useDiagramCrdt({ doc, canWrite });

  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(diagram.viewport?.zoom ?? 0.85);
  const [pan, setPan] = useState({ x: diagram.viewport?.x ?? 40, y: diagram.viewport?.y ?? 40 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "connect">("select");
  const [editingNode, setEditingNode] = useState<SystemNode | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);

  // Dragging state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Handle keydown delete
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
        }
      } else if (e.key.toLowerCase() === "v") {
        setActiveTool("select");
      } else if (e.key.toLowerCase() === "c") {
        setActiveTool("connect");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, selectedEdgeId, canWrite, deleteNode, deleteEdge]);

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

  // Canvas Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan if clicking canvas background directly
    if (e.target === containerRef.current || (e.target as HTMLElement).dataset.canvasBg) {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setConnectingFromId(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
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

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedNodeId(null);
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: SystemNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);

    if (activeTool === "connect") {
      if (!connectingFromId) {
        setConnectingFromId(node.id);
      } else if (connectingFromId !== node.id) {
        // Connect them!
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
  };

  const handleAddGroup = () => {
    if (!canWrite) return;
    const id = `grp-${Date.now()}`;
    const x = Math.round((100 - pan.x) / zoom);
    const y = Math.round((100 - pan.y) / zoom);
    addGroup({
      id,
      label: "New Architecture Subnet / Cluster",
      x,
      y,
      width: 480,
      height: 350,
      color: "zinc",
    });
  };

  // Auto-Layout Algorithm
  const handleAutoLayout = () => {
    if (!canWrite) return;
    const nodes = [...diagram.nodes];
    if (nodes.length === 0) return;

    // Group nodes by role / type
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
      else if (n.type === "service") tiers.service.push(n);
      else if (n.type === "queue") tiers.queue.push(n);
      else tiers.database.push(n);
    });

    const tierOrder = ["client", "gateway", "service", "queue", "database"];
    let startX = 80;
    const updatedNodes: SystemNode[] = [];

    tierOrder.forEach((t) => {
      const groupNodes = tiers[t];
      if (groupNodes && groupNodes.length > 0) {
        let startY = 100;
        groupNodes.forEach((n) => {
          updatedNodes.push({
            ...n,
            x: startX,
            y: startY,
          });
          startY += 120;
        });
        startX += 290;
      }
    });

    setFullDiagram({
      ...diagram,
      nodes: updatedNodes,
      viewport: { x: 50, y: 50, zoom: 0.85 },
    });
    setPan({ x: 50, y: 50 });
    setZoom(0.85);
  };

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      data-canvas-bg="true"
      className={cn(
        "relative flex h-full w-full select-none overflow-hidden bg-[#0d0f12] text-foreground font-sans",
        isPanning ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        className,
      )}
      style={{
        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
        backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
    >
      {/* ── Left Floating Eraser-Style Tool Palette ──────────────────────── */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 rounded-2xl border border-zinc-800/90 bg-zinc-900/95 p-1.5 shadow-2xl backdrop-blur-md">
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

        <button
          type="button"
          title="Connect Components with Arrow (C)"
          onClick={() => {
            setActiveTool("connect");
            setConnectingFromId(null);
          }}
          className={cn(
            "flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white",
            activeTool === "connect" && "bg-primary text-white hover:bg-primary",
          )}
        >
          <ArrowRight className="size-4.5" />
        </button>

        <span className="my-1 h-px w-full bg-zinc-800" />

        <button
          type="button"
          title="Add Service / Worker (R)"
          onClick={() => handleAddService("service")}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <Server className="size-4.5" />
        </button>

        <button
          type="button"
          title="Add Database (D)"
          onClick={() => handleAddService("database")}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <Database className="size-4.5" />
        </button>

        <button
          type="button"
          title="Add Message Queue / Kafka (Q)"
          onClick={() => handleAddService("queue")}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <MessageSquare className="size-4.5" />
        </button>

        <button
          type="button"
          title="Add Architecture Container / VPC Boundary (G)"
          onClick={handleAddGroup}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <Box className="size-4.5" />
        </button>

        <span className="my-1 h-px w-full bg-zinc-800" />

        <button
          type="button"
          title="Auto Layout Diagram"
          onClick={handleAutoLayout}
          disabled={!canWrite}
          className="flex size-9 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <LayoutGrid className="size-4.5" />
        </button>

        <button
          type="button"
          title="Eraser AI: Generate System Design from Prompt"
          onClick={() => setAiModalOpen(true)}
          className="flex size-9 items-center justify-center rounded-xl bg-violet-600/20 text-violet-400 transition-colors hover:bg-violet-600 hover:text-white"
        >
          <Sparkles className="size-4.5" />
        </button>
      </div>

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

      {/* ── Active Connect Tool Hint ────────────────────────────────────── */}
      {activeTool === "connect" && (
        <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2 rounded-full border border-violet-500/50 bg-violet-950/90 px-4 py-1.5 text-xs font-semibold text-violet-200 shadow-2xl backdrop-blur-md">
          {connectingFromId
            ? "Click target component to complete arrow connection"
            : "Click source component to start arrow connection"}
        </div>
      )}

      {/* ── Main Canvas Viewport (Transformed by pan & zoom) ─────────────── */}
      <div
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Connectors Layer */}
        <svg className="pointer-events-none absolute inset-0 h-[5000px] w-[5000px] overflow-visible">
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

          {diagram.edges.map((edge) => {
            const fromNode = diagram.nodes.find((n) => n.id === edge.from);
            const toNode = diagram.nodes.find((n) => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            // Compute connection points (center-to-center or edge intersection)
            const x1 = fromNode.x + fromNode.width / 2;
            const y1 = fromNode.y + fromNode.height / 2;
            const x2 = toNode.x + toNode.width / 2;
            const y2 = toNode.y + toNode.height / 2;

            // Bezier control offset
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
                className="pointer-events-auto cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEdgeId(edge.id);
                  setSelectedNodeId(null);
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
              style={{
                transform: `translate(${group.x}px, ${group.y}px)`,
                width: `${group.width}px`,
                height: `${group.height}px`,
              }}
              className={cn(
                "group/grp absolute rounded-2xl border-2 border-dashed bg-zinc-950/40 p-3 transition-colors",
                colorCfg.border,
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
                    onClick={() => deleteGroup(group.id)}
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
