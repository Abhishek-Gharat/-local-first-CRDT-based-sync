"use client";

import React, { memo } from "react";
import {
  Server,
  Database,
  Layers,
  Globe,
  HardDrive,
  Cloud,
  MessageSquare,
  Shield,
  ArrowUpRight,
  Plus,
  Minus,
  Sparkles,
  RotateCcw,
  Download,
  LayoutGrid,
  Trash2,
  MousePointer,
  Box,
  Pencil,
  Eraser,
  Square,
  Circle,
  Type,
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
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CanvasTool } from "./system-design-canvas";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3.0;
export const ZOOM_FACTOR = 1.2;

export const COLOR_MAP: Record<
  NodeColor,
  { border: string; bg: string; text: string; ring: string }
> = {
  blue: {
    border: "border-sky-500/40 dark:border-sky-500/60",
    bg: "bg-sky-500/10 dark:bg-sky-500/15",
    text: "text-sky-600 dark:text-sky-400",
    ring: "ring-sky-500/30",
  },
  emerald: {
    border: "border-emerald-500/40 dark:border-emerald-500/60",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
  },
  violet: {
    border: "border-violet-500/40 dark:border-violet-500/60",
    bg: "bg-violet-500/10 dark:bg-violet-500/15",
    text: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30",
  },
  amber: {
    border: "border-amber-500/40 dark:border-amber-500/60",
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
  },
  rose: {
    border: "border-rose-500/40 dark:border-rose-500/60",
    bg: "bg-rose-500/10 dark:bg-rose-500/15",
    text: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30",
  },
  cyan: {
    border: "border-cyan-500/40 dark:border-cyan-500/60",
    bg: "bg-cyan-500/10 dark:bg-cyan-500/15",
    text: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-500/30",
  },
  zinc: {
    border: "border-border",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    ring: "ring-border",
  },
  orange: {
    border: "border-orange-500/40 dark:border-orange-500/60",
    bg: "bg-orange-500/10 dark:bg-orange-500/15",
    text: "text-orange-600 dark:text-orange-400",
    ring: "ring-orange-500/30",
  },
};

export const DRAW_PALETTE = [
  { color: "auto", label: "Auto Theme" },
  { color: "#8b5cf6", label: "Violet" },
  { color: "#0ea5e9", label: "Sky" },
  { color: "#10b981", label: "Emerald" },
  { color: "#f59e0b", label: "Amber" },
  { color: "#f43f5e", label: "Rose" },
];

export function getNodeIcon(type: NodeType) {
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

export function pointsToSvgPath(points: { x: number; y: number }[]): string {
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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Memoized Nodes Layer (Only re-renders when nodes, selection or drag changes)
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasNodesLayer = memo(function CanvasNodesLayer({
  nodes,
  selectedNodeId,
  connectingFromId,
  draggedNode,
  activeTool,
  canWrite,
  onNodeMouseDown,
  onDoubleClickNode,
  onConnectClick,
}: {
  nodes: SystemNode[];
  selectedNodeId: string | null;
  connectingFromId: string | null;
  draggedNode: { id: string; x: number; y: number } | null;
  activeTool: CanvasTool;
  canWrite: boolean;
  onNodeMouseDown: (e: React.PointerEvent, node: SystemNode) => void;
  onDoubleClickNode: (node: SystemNode) => void;
  onConnectClick: (nodeId: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const Icon = getNodeIcon(node.type);
        const colorCfg = COLOR_MAP[node.color] ?? COLOR_MAP.blue;
        const isSelected = selectedNodeId === node.id;
        const isConnectingSource = connectingFromId === node.id;
        const posX = draggedNode && draggedNode.id === node.id ? draggedNode.x : node.x;
        const posY = draggedNode && draggedNode.id === node.id ? draggedNode.y : node.y;

        return (
          <div
            key={node.id}
            onPointerDown={(e) => onNodeMouseDown(e, node)}
            onDoubleClick={() => onDoubleClickNode(node)}
            style={{
              transform: `translate(${posX}px, ${posY}px)`,
              width: `${node.width}px`,
              height: `${node.height}px`,
            }}
            className={cn(
              "group/node absolute flex cursor-grab flex-col justify-between rounded-xl border bg-card/95 p-3 shadow-md backdrop-blur-md transition-shadow active:cursor-grabbing",
              colorCfg.border,
              isSelected && "ring-2 ring-primary border-primary shadow-xl",
              isConnectingSource && "ring-3 ring-violet-500 border-violet-400 animate-pulse",
              activeTool === "eraser" && "hover:border-destructive hover:bg-destructive/10 cursor-cell",
              activeTool === "draw" && "pointer-events-none",
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
                  <p className="truncate text-xs font-bold tracking-tight text-card-foreground">
                    {node.label}
                  </p>
                  {node.sublabel && (
                    <p className="truncate text-[10px] font-medium text-muted-foreground">
                      {node.sublabel}
                    </p>
                  )}
                </div>
              </div>

              {node.technology && (
                <span className="shrink-0 rounded border border-border/80 bg-muted/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
                  {node.technology}
                </span>
              )}
            </div>

            {/* Status footer */}
            <div className="mt-auto flex items-center justify-between pt-1 border-t border-border/50 text-[9.5px] text-muted-foreground">
              <span className="capitalize">{node.type}</span>
              <span className="flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                Active
              </span>
            </div>

            {/* Connector dot indicator for connecting mode */}
            <div
              title="Connect"
              onClick={(e) => {
                e.stopPropagation();
                onConnectClick(node.id);
              }}
              className={cn(
                "absolute -right-1.5 top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-background bg-muted-foreground/60 transition-all hover:scale-125 hover:bg-primary",
                isSelected && "bg-primary scale-110",
                isConnectingSource && "bg-primary scale-125",
              )}
            />
          </div>
        );
      })}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Memoized Edges Layer
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasEdgesLayer = memo(function CanvasEdgesLayer({
  edges,
  nodes,
  selectedEdgeId,
  draggedNode,
  activeTool,
  canWrite,
  onEdgeClick,
  onEdgePointerEnter,
}: {
  edges: SystemEdge[];
  nodes: SystemNode[];
  selectedEdgeId: string | null;
  draggedNode: { id: string; x: number; y: number } | null;
  activeTool: CanvasTool;
  canWrite: boolean;
  onEdgeClick: (e: React.MouseEvent, edgeId: string) => void;
  onEdgePointerEnter: (edgeId: string) => void;
}) {
  return (
    <>
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.from);
        const toNode = nodes.find((n) => n.id === edge.to);
        if (!fromNode || !toNode) return null;

        const fromX = draggedNode && draggedNode.id === fromNode.id ? draggedNode.x : fromNode.x;
        const fromY = draggedNode && draggedNode.id === fromNode.id ? draggedNode.y : fromNode.y;
        const toX = draggedNode && draggedNode.id === toNode.id ? draggedNode.x : toNode.x;
        const toY = draggedNode && draggedNode.id === toNode.id ? draggedNode.y : toNode.y;

        const x1 = fromX + fromNode.width / 2;
        const y1 = fromY + fromNode.height / 2;
        const x2 = toX + toNode.width / 2;
        const y2 = toY + toNode.height / 2;

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
              activeTool === "draw" && "pointer-events-none",
            )}
            onClick={(e) => onEdgeClick(e, edge.id)}
            onPointerEnter={() => onEdgePointerEnter(edge.id)}
          >
            {/* Thick hit target */}
            <path d={pathData} fill="none" stroke="transparent" strokeWidth="20" />
            {/* Visible line */}
            <path
              d={pathData}
              fill="none"
              stroke={isSelected ? "var(--canvas-edge-selected)" : "var(--canvas-edge)"}
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
                  fill="var(--canvas-node-bg)"
                  stroke={isSelected ? "var(--canvas-edge-selected)" : "var(--canvas-node-border)"}
                  strokeWidth="1"
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fill="var(--color-foreground)"
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
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Memoized Groups Layer
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasGroupsLayer = memo(function CanvasGroupsLayer({
  groups,
  activeTool,
  canWrite,
  draggedGroup,
  onGroupClick,
  onDeleteGroup,
}: {
  groups: SystemGroup[];
  activeTool: CanvasTool;
  canWrite: boolean;
  draggedGroup: { id: string; x: number; y: number } | null;
  onGroupClick: (e: React.PointerEvent, groupId: string) => void;
  onDeleteGroup: (id: string) => void;
}) {
  return (
    <>
      {groups.map((group) => {
        const colorCfg = COLOR_MAP[group.color] ?? COLOR_MAP.zinc;
        const posX = draggedGroup && draggedGroup.id === group.id ? draggedGroup.x : group.x;
        const posY = draggedGroup && draggedGroup.id === group.id ? draggedGroup.y : group.y;
        return (
          <div
            key={group.id}
            onPointerDown={(e) => onGroupClick(e, group.id)}
            onClick={(e) => {
              if (activeTool === "eraser" && canWrite) {
                e.stopPropagation();
                onDeleteGroup(group.id);
              }
            }}
            style={{
              transform: `translate(${posX}px, ${posY}px)`,
              width: `${group.width}px`,
              height: `${group.height}px`,
            }}
            className={cn(
              "group/grp absolute rounded-2xl border-2 border-dashed border-border-strong bg-muted/20 dark:bg-muted/10 p-3 transition-colors cursor-grab",
              colorCfg.border,
              activeTool === "eraser" && "hover:border-destructive hover:bg-destructive/10 cursor-cell",
              activeTool === "draw" && "pointer-events-none",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1 text-xs font-bold tracking-tight text-card-foreground shadow-xs">
                <Box className="size-3.5 text-muted-foreground" />
                {group.label}
              </span>
              {canWrite && (
                <button
                  type="button"
                  title="Delete group"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteGroup(group.id);
                  }}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover/grp:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Memoized Drawings Layer
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasDrawingsLayer = memo(function CanvasDrawingsLayer({
  drawings,
  selectedDrawingId,
  activeTool,
  canWrite,
  draggedDrawing,
  onDrawingClick,
  onDrawingPointerEnter,
}: {
  drawings?: SystemDrawing[];
  selectedDrawingId: string | null;
  activeTool: CanvasTool;
  canWrite: boolean;
  draggedDrawing: { id: string; x: number; y: number } | null;
  onDrawingClick: (e: React.PointerEvent, id: string) => void;
  onDrawingPointerEnter: (id: string) => void;
}) {
  if (!drawings || drawings.length === 0) return null;
  return (
    <>
      {drawings.map((drawing) => {
        const isDragging = draggedDrawing?.id === drawing.id;
        const points = isDragging && drawing.points.length > 0
          ? drawing.points.map((p) => ({
              x: p.x + (draggedDrawing!.x - drawing.points[0].x),
              y: p.y + (draggedDrawing!.y - drawing.points[0].y),
            }))
          : drawing.points;
        const pathD = pointsToSvgPath(points);
        const isSelected = selectedDrawingId === drawing.id;
        const strokeColor =
          drawing.color === "auto" ? "var(--color-foreground)" : drawing.color;

        return (
          <g
            key={drawing.id}
            className={cn(
              "pointer-events-auto cursor-pointer transition-opacity",
              activeTool === "eraser" && "hover:opacity-30",
              activeTool === "draw" && "pointer-events-none",
              isDragging && "cursor-grabbing",
            )}
            onPointerDown={(e) => onDrawingClick(e, drawing.id)}
            onPointerEnter={() => onDrawingPointerEnter(drawing.id)}
          >
            <path
              d={pathD}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(24, drawing.strokeWidth * 4)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={pathD}
              fill="none"
              stroke={isSelected ? "var(--canvas-edge-selected)" : strokeColor}
              strokeWidth={drawing.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={drawing.tool === "highlighter" ? 0.45 : 1}
            />
          </g>
        );
      })}
    </>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Active In-Progress Stroke Layer
// ─────────────────────────────────────────────────────────────────────────────
export const ActiveStrokeLayer = memo(function ActiveStrokeLayer({
  currentStroke,
  draggedDrawing,
}: {
  currentStroke: SystemDrawing | null;
  draggedDrawing: { id: string; x: number; y: number } | null;
}) {
  if (currentStroke && currentStroke.points.length > 0) {
    const strokeColor =
      currentStroke.color === "auto" ? "var(--color-foreground)" : currentStroke.color;

    return (
      <path
        d={pointsToSvgPath(currentStroke.points)}
        fill="none"
        stroke={strokeColor}
        strokeWidth={currentStroke.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={currentStroke.tool === "highlighter" ? 0.45 : 1}
      />
    );
  }

  if (draggedDrawing) {
    return null;
  }

  return null;
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Memoized Left Toolbar (Unified with product design system)
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasToolbar = memo(function CanvasToolbar({
  activeTool,
  canWrite,
  insertMenuOpen,
  onToggleInsertMenu,
  onAddService,
  onOpenAiModal,
  onSelectTool,
  onAutoLayout,
}: {
  activeTool: CanvasTool;
  canWrite: boolean;
  insertMenuOpen: boolean;
  onToggleInsertMenu: () => void;
  onAddService: (type: NodeType) => void;
  onOpenAiModal: () => void;
  onSelectTool: (tool: CanvasTool) => void;
  onAutoLayout: () => void;
}) {
  return (
    <div className="absolute top-4 left-4 z-30 flex flex-col gap-1 rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-xl backdrop-blur-md">
      {/* Insert Menu */}
      <div className="relative">
        <TooltipButton
          label="Insert Component (J)"
          shortcut={["J"]}
          tooltipSide="right"
          variant="ghost"
          onClick={onToggleInsertMenu}
          className="size-9 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4.5" />
        </TooltipButton>

        {insertMenuOpen && (
          <div className="absolute top-0 left-12 z-50 flex w-64 flex-col rounded-2xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-md">
            <p className="px-2 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Add Architecture Component
            </p>
            <button
              type="button"
              onClick={() => onAddService("service")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Server className="size-4 text-violet-500" />
              <span>Microservice Worker</span>
            </button>
            <button
              type="button"
              onClick={() => onAddService("database")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Database className="size-4 text-emerald-500" />
              <span>PostgreSQL / Database</span>
            </button>
            <button
              type="button"
              onClick={() => onAddService("queue")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <MessageSquare className="size-4 text-amber-500" />
              <span>Kafka Event Broker</span>
            </button>
            <button
              type="button"
              onClick={() => onAddService("storage")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <HardDrive className="size-4 text-cyan-500" />
              <span>S3 Storage / Bucket</span>
            </button>
            <button
              type="button"
              onClick={() => onAddService("gateway")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Shield className="size-4 text-sky-500" />
              <span>API Gateway / Proxy</span>
            </button>
            <button
              type="button"
              onClick={() => onAddService("client")}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Globe className="size-4 text-muted-foreground" />
              <span>Web / Mobile Client</span>
            </button>
          </div>
        )}
      </div>

      <TooltipButton
        label="Eraser AI (Ctrl+J)"
        shortcut={["mod", "J"]}
        tooltipSide="right"
        variant="ghost"
        onClick={onOpenAiModal}
        className="size-9 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
      >
        <Sparkles className="size-4.5" />
      </TooltipButton>

      <span className="my-1 h-px w-full bg-border" />

      <TooltipButton
        label="Select / Move Tool (V)"
        shortcut={["V"]}
        tooltipSide="right"
        variant={activeTool === "select" ? "default" : "ghost"}
        onClick={() => onSelectTool("select")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "select"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <MousePointer className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Rectangle Shape (R)"
        shortcut={["R"]}
        tooltipSide="right"
        variant={activeTool === "rectangle" ? "default" : "ghost"}
        onClick={() => onSelectTool("rectangle")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "rectangle"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Square className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Circle Shape (O)"
        shortcut={["O"]}
        tooltipSide="right"
        variant={activeTool === "circle" ? "default" : "ghost"}
        onClick={() => onSelectTool("circle")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "circle"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Circle className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Connect Components (A / C)"
        shortcut={["A"]}
        tooltipSide="right"
        variant={activeTool === "connect" ? "default" : "ghost"}
        onClick={() => onSelectTool("connect")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "connect"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <ArrowUpRight className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Draw / Pen Tool (P / D)"
        shortcut={["P"]}
        tooltipSide="right"
        variant={activeTool === "draw" ? "default" : "ghost"}
        onClick={() => onSelectTool("draw")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "draw"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Pencil className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Eraser Tool (E)"
        shortcut={["E"]}
        tooltipSide="right"
        variant={activeTool === "eraser" ? "destructive" : "ghost"}
        onClick={() => onSelectTool("eraser")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "eraser"
            ? "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Eraser className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Text Note (T)"
        shortcut={["T"]}
        tooltipSide="right"
        variant={activeTool === "text" ? "default" : "ghost"}
        onClick={() => onSelectTool("text")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "text"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Type className="size-4.5" />
      </TooltipButton>

      <TooltipButton
        label="Container / Boundary (F)"
        shortcut={["F"]}
        tooltipSide="right"
        variant={activeTool === "group" ? "default" : "ghost"}
        onClick={() => onSelectTool("group")}
        className={cn(
          "size-9 rounded-xl",
          activeTool === "group"
            ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        <Box className="size-4.5" />
      </TooltipButton>

      <span className="my-1 h-px w-full bg-border" />

      <TooltipButton
        label="Auto Layout Diagram"
        tooltipSide="right"
        variant="ghost"
        onClick={onAutoLayout}
        disabled={!canWrite}
        className="size-9 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <LayoutGrid className="size-4.5" />
      </TooltipButton>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Memoized Draw Sub-Palette
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasDrawSubPalette = memo(function CanvasDrawSubPalette({
  drawMode,
  drawColor,
  drawWidth,
  hasDrawings,
  onSetDrawMode,
  onSetDrawColor,
  onSetDrawWidth,
  onClearDrawings,
}: {
  drawMode: "pen" | "highlighter";
  drawColor: string;
  drawWidth: number;
  hasDrawings: boolean;
  onSetDrawMode: (mode: "pen" | "highlighter") => void;
  onSetDrawColor: (color: string) => void;
  onSetDrawWidth: (width: number) => void;
  onClearDrawings: () => void;
}) {
  return (
    <div className="absolute top-4 left-18 z-30 flex items-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-3 py-1.5 shadow-xl backdrop-blur-md text-card-foreground">
      {/* Pen vs Highlighter */}
      <div className="flex items-center rounded-xl bg-muted p-0.5">
        <button
          type="button"
          onClick={() => onSetDrawMode("pen")}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
            drawMode === "pen"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Pen
        </button>
        <button
          type="button"
          onClick={() => onSetDrawMode("highlighter")}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
            drawMode === "highlighter"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Highlighter
        </button>
      </div>

      <span className="h-4 w-px bg-border" />

      {/* Color Swatches */}
      <div className="flex items-center gap-1.5">
        {DRAW_PALETTE.map((c) => (
          <button
            key={c.color}
            type="button"
            title={c.label}
            onClick={() => onSetDrawColor(c.color)}
            className={cn(
              "size-5.5 rounded-full border border-border shadow-xs transition-transform hover:scale-115",
              drawColor === c.color && "scale-115 ring-2 ring-primary ring-offset-1 ring-offset-background",
            )}
            style={{
              backgroundColor: c.color === "auto" ? "var(--color-foreground)" : c.color,
            }}
          />
        ))}
      </div>

      <span className="h-4 w-px bg-border" />

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
            onClick={() => onSetDrawWidth(item.w)}
            className={cn(
              "flex size-7 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
              drawWidth === item.w
                ? "bg-muted text-foreground shadow-xs font-bold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span
              className="rounded-full bg-current"
              style={{ width: item.w * 1.5, height: item.w * 1.5 }}
            />
          </button>
        ))}
      </div>

      {hasDrawings && (
        <>
          <span className="h-4 w-px bg-border" />
          <button
            type="button"
            title="Clear all manual drawings"
            onClick={onClearDrawings}
            className="flex size-7 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Memoized Header Controls (Top-Right)
// ─────────────────────────────────────────────────────────────────────────────
export const CanvasHeaderControls = memo(function CanvasHeaderControls({
  zoom,
  diagram,
  templateMenuOpen,
  onOpenAiModal,
  onToggleTemplateMenu,
  onLoadTemplate,
  onExportSvg,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  minZoom = MIN_ZOOM,
  maxZoom = MAX_ZOOM,
}: {
  zoom: number;
  diagram: DiagramModel;
  templateMenuOpen: boolean;
  onOpenAiModal: () => void;
  onToggleTemplateMenu: () => void;
  onLoadTemplate: (key: keyof typeof SYSTEM_DESIGN_TEMPLATES) => void;
  onExportSvg: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  minZoom?: number;
  maxZoom?: number;
}) {
  return (
    <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
      <Button
        onClick={onOpenAiModal}
        size="sm"
        className="h-9 gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 font-semibold shadow-md hover:bg-primary/90 active:scale-95"
      >
        <Sparkles className="size-4" />
        Eraser AI
      </Button>

      {/* Templates Dropdown */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleTemplateMenu}
          className="h-9 gap-1.5 rounded-xl border-border bg-card/90 text-xs font-semibold text-foreground shadow-md backdrop-blur-md hover:bg-accent"
        >
          <Layers className="size-3.5" />
          Templates
        </Button>

        {templateMenuOpen && (
          <div className="absolute top-11 right-0 z-50 flex w-72 flex-col rounded-2xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-md">
            <p className="px-2 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              System Design Presets
            </p>
            {Object.entries(SYSTEM_DESIGN_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                type="button"
                onClick={() => onLoadTemplate(key as keyof typeof SYSTEM_DESIGN_TEMPLATES)}
                className="flex flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <span className="text-xs font-semibold text-foreground">{tpl.name}</span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
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
        onClick={onExportSvg}
        className="h-9 gap-1.5 rounded-xl border-border bg-card/90 text-xs font-semibold text-foreground shadow-md backdrop-blur-md hover:bg-accent"
      >
        <Download className="size-3.5" />
        Export
      </Button>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-card/90 p-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoom <= minZoom}
          aria-label="Zoom out"
          title="Zoom Out"
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            zoom <= minZoom &&
              "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
          )}
        >
          <Minus className="size-3.5" />
        </button>
        <span className="w-12 text-center font-mono text-xs font-semibold text-foreground select-none">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoom >= maxZoom}
          aria-label="Zoom in"
          title="Zoom In"
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            zoom >= maxZoom &&
              "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
          )}
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          title="Reset Zoom to 100%"
          aria-label="Reset zoom"
          onClick={onResetZoom}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Node Edit Dialog (Unified with design system)
// ─────────────────────────────────────────────────────────────────────────────
export const NodeEditDialog = memo(function NodeEditDialog({
  editingNode,
  onClose,
  onSave,
  onDelete,
}: {
  editingNode: SystemNode;
  onClose: () => void;
  onSave: (node: SystemNode) => void;
  onDelete: (id: string) => void;
}) {
  const [node, setNode] = React.useState(editingNode);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl text-card-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground">Edit Component</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">
              Component Label
            </label>
            <Input
              value={node.label}
              onChange={(e) => setNode({ ...node, label: e.target.value })}
              className="mt-1 border-input bg-background text-foreground"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">
              Subtitle / Description
            </label>
            <Input
              value={node.sublabel ?? ""}
              onChange={(e) => setNode({ ...node, sublabel: e.target.value })}
              className="mt-1 border-input bg-background text-foreground"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">
              Technology / Protocol
            </label>
            <Input
              value={node.technology ?? ""}
              onChange={(e) => setNode({ ...node, technology: e.target.value })}
              placeholder="e.g. PostgreSQL 16, Kafka, gRPC"
              className="mt-1 border-input bg-background text-foreground"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">
              Accent Color
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                ["blue", "violet", "emerald", "amber", "rose", "cyan", "zinc"] as NodeColor[]
              ).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNode({ ...node, color: c })}
                  className={cn(
                    "size-7 rounded-lg border border-border capitalize transition-transform hover:scale-110",
                    COLOR_MAP[c].bg,
                    node.color === c && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-between border-t border-border pt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onSave(node);
                onClose();
              }}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
