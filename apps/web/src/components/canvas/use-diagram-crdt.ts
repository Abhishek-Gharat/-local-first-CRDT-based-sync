"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import {
  type DiagramModel,
  type SystemNode,
  type SystemEdge,
  type SystemGroup,
  type SystemDrawing,
  DiagramModelSchema,
  createEmptyDiagram,
  SYSTEM_DESIGN_TEMPLATES,
} from "shared";

const DIAGRAM_MAP_NAME = "diagram";
const DIAGRAM_KEY = "model";

export function useDiagramCrdt({
  doc,
  canWrite = true,
}: {
  doc: Y.Doc;
  canWrite?: boolean;
}) {
  const [diagram, setDiagramState] = useState<DiagramModel>(() => {
    const map = doc.getMap(DIAGRAM_MAP_NAME);
    const raw = map.get(DIAGRAM_KEY);
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        const validated = DiagramModelSchema.safeParse(parsed);
        if (validated.success) return validated.data;
      } catch {
        /* fall through */
      }
    }
    // Default to a rich, impressive template if completely empty
    return SYSTEM_DESIGN_TEMPLATES.localFirstCrdt.diagram;
  });

  const diagramRef = useRef(diagram);
  useEffect(() => {
    diagramRef.current = diagram;
  }, [diagram]);

  // Sync state into Y.Doc
  const commitToDoc = useCallback(
    (next: DiagramModel | ((prev: DiagramModel) => DiagramModel)) => {
      if (!canWrite) return;
      const nextModel =
        typeof next === "function" ? next(diagramRef.current) : next;
      setDiagramState(nextModel);
      diagramRef.current = nextModel;

      doc.transact(() => {
        const map = doc.getMap(DIAGRAM_MAP_NAME);
        map.set(DIAGRAM_KEY, JSON.stringify(nextModel));
      }, "diagram-local");
    },
    [canWrite, doc],
  );

  // Listen to remote changes or other users updating the diagram
  useEffect(() => {
    const map = doc.getMap(DIAGRAM_MAP_NAME);

    // If doc was empty, initialize with default template
    if (!map.has(DIAGRAM_KEY) && canWrite) {
      doc.transact(() => {
        map.set(
          DIAGRAM_KEY,
          JSON.stringify(SYSTEM_DESIGN_TEMPLATES.localFirstCrdt.diagram),
        );
      }, "diagram-init");
    }

    const observer = (event: Y.YMapEvent<unknown>, transaction: Y.Transaction) => {
      if (transaction.origin === "diagram-local") return;

      const raw = map.get(DIAGRAM_KEY);
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          const validated = DiagramModelSchema.safeParse(parsed);
          if (validated.success) {
            setDiagramState(validated.data);
            diagramRef.current = validated.data;
          }
        } catch {
          /* ignore corrupted input */
        }
      }
    };

    map.observe(observer);
    return () => {
      map.unobserve(observer);
    };
  }, [canWrite, doc]);

  // Operations
  const addNode = useCallback(
    (node: SystemNode) => {
      commitToDoc((prev) => ({
        ...prev,
        nodes: [...prev.nodes, node],
      }));
    },
    [commitToDoc],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<SystemNode>) => {
      commitToDoc((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      }));
    },
    [commitToDoc],
  );

  const deleteNode = useCallback(
    (id: string) => {
      commitToDoc((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== id),
        edges: prev.edges.filter((e) => e.from !== id && e.to !== id),
      }));
    },
    [commitToDoc],
  );

  const addEdge = useCallback(
    (edge: SystemEdge) => {
      commitToDoc((prev) => {
        // Prevent duplicate edges
        if (
          prev.edges.some(
            (e) =>
              (e.from === edge.from && e.to === edge.to) ||
              (e.from === edge.to && e.to === edge.from),
          )
        ) {
          return prev;
        }
        return {
          ...prev,
          edges: [...prev.edges, edge],
        };
      });
    },
    [commitToDoc],
  );

  const deleteEdge = useCallback(
    (id: string) => {
      commitToDoc((prev) => ({
        ...prev,
        edges: prev.edges.filter((e) => e.id !== id),
      }));
    },
    [commitToDoc],
  );

  const addGroup = useCallback(
    (group: SystemGroup) => {
      commitToDoc((prev) => ({
        ...prev,
        groups: [...prev.groups, group],
      }));
    },
    [commitToDoc],
  );

  const updateGroup = useCallback(
    (id: string, patch: Partial<SystemGroup>) => {
      commitToDoc((prev) => ({
        ...prev,
        groups: prev.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      }));
    },
    [commitToDoc],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      commitToDoc((prev) => ({
        ...prev,
        groups: prev.groups.filter((g) => g.id !== id),
        nodes: prev.nodes.map((n) =>
          n.parentId === id ? { ...n, parentId: undefined } : n,
        ),
      }));
    },
    [commitToDoc],
  );

  const setViewport = useCallback(
    (viewport: { x: number; y: number; zoom: number }) => {
      commitToDoc((prev) => ({
        ...prev,
        viewport,
      }));
    },
    [commitToDoc],
  );

  const setFullDiagram = useCallback(
    (model: DiagramModel) => {
      commitToDoc(model);
    },
    [commitToDoc],
  );

  const loadTemplate = useCallback(
    (templateKey: keyof typeof SYSTEM_DESIGN_TEMPLATES) => {
      const tpl = SYSTEM_DESIGN_TEMPLATES[templateKey];
      if (tpl) {
        commitToDoc(tpl.diagram);
      }
    },
    [commitToDoc],
  );

  const addDrawing = useCallback(
    (drawing: SystemDrawing) => {
      commitToDoc((prev) => ({
        ...prev,
        drawings: [...(prev.drawings ?? []), drawing],
      }));
    },
    [commitToDoc],
  );

  const deleteDrawing = useCallback(
    (id: string) => {
      commitToDoc((prev) => ({
        ...prev,
        drawings: (prev.drawings ?? []).filter((d) => d.id !== id),
      }));
    },
    [commitToDoc],
  );

  const clearDrawings = useCallback(() => {
    commitToDoc((prev) => ({
      ...prev,
      drawings: [],
    }));
  }, [commitToDoc]);

  return {
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
    canWrite,
  };
}
