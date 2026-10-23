import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  NodeResizer,
  MarkerType,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import {
  Smartphone,
  Zap,
  GitBranch,
  Globe,
  MessageSquare,
  PanelBottom,
  MessageCircle,
  Bell,
} from "lucide-react";
import type {
  FlowGraphPayload,
  FlowNodeData,
  RoleViewMode,
} from "../types/graph";
import { layout, nodeSize, type Direction } from "../engine/elkLayout";
import { edgeKind, edgeLabels, edgeHasEvidence } from "../engine/graphView";
import { colors } from "../theme/tokens";
import { branchKey } from "../engine/pathInference";
export type ConnectorStyle = "auto" | "curve" | "step" | "straight";
const icons = {
  SCREEN: Smartphone,
  ACTION: Zap,
  DECISION: GitBranch,
  API: Globe,
  DIALOG: MessageSquare,
  BOTTOMSHEET: PanelBottom,
  SNACKBAR: MessageCircle,
  TOAST: Bell,
};
type Size = { width: number; height: number };
type StudioNode = Node<{
  node: FlowNodeData;
  mode: RoleViewMode;
  direction: Direction;
  highlighted?: boolean;
  size: Size;
  resize: (size: Size) => void;
}>;
function FlowNode({ data, selected }: NodeProps<StudioNode>) {
  const n = data.node,
    Icon = icons[n.kind],
    vertical = data.direction === "DOWN";
  const route =
    n.routeInfo?.routePath ||
    n.routeInfo?.aliases?.find((a) => a.startsWith("/"));
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={240}
        minHeight={140}
        handleStyle={{ width: 24, height: 24, borderRadius: 5 }}
        lineStyle={{ borderWidth: 2 }}
      />
      <article
        className={`flow-node ${selected ? "selected" : ""} ${data.highlighted ? "spotlight-node" : ""}`}
        style={{ borderColor: colors[n.kind] }}
      >
        <Handle
          type="target"
          position={vertical ? Position.Top : Position.Left}
        />
        <div className="node-kind">
          <span style={{ background: colors[n.kind] }}>
            <Icon size={16} aria-hidden="true" />
            {n.kind}
          </span>
          <span className="node-grip" aria-hidden="true">
            ⠿
          </span>
        </div>
        <strong>
          {data.mode === "DEV" ? n.technicalTitle : n.businessTitle}
        </strong>
        {n.kind === "SCREEN" && (
          <div className="node-route">
            <code>{route || "Chưa xác định route"}</code>
            {n.routeInfo?.router && (
              <small>
                {n.routeInfo.router}
                {n.routeInfo.isInitialRoute ? " · Khởi đầu" : ""}
              </small>
            )}
          </div>
        )}
        {n.apiInfo && (
          <small>
            {n.apiInfo.method} {n.apiInfo.endpoint}
          </small>
        )}
        {selected && (
          <div
            className="node-sizing nodrag nopan"
            aria-label="Kích thước node"
          >
            <label>
              Rộng
              <input
                type="number"
                aria-label="Chiều rộng node"
                min={240}
                step={20}
                value={Math.round(data.size.width)}
                onChange={(e) => {
                  const width = Number(e.target.value);
                  if (Number.isFinite(width) && width >= 240)
                    data.resize({ ...data.size, width });
                }}
              />
            </label>
            <label>
              Cao
              <input
                type="number"
                aria-label="Chiều cao node"
                min={140}
                step={20}
                value={Math.round(data.size.height)}
                onChange={(e) => {
                  const height = Number(e.target.value);
                  if (Number.isFinite(height) && height >= 140)
                    data.resize({ ...data.size, height });
                }}
              />
            </label>
          </div>
        )}
        {n.decisionInfo ? (
          n.decisionInfo.branches.map((b, i) => (
            <Handle
              key={b.branchId}
              type="source"
              id={b.branchId}
              position={vertical ? Position.Bottom : Position.Right}
              style={{
                [vertical ? "left" : "top"]:
                  `${25 + (60 * i) / Math.max(1, n.decisionInfo!.branches.length - 1)}%`,
              }}
              role="img"
              aria-label={b.businessLabel}
            />
          ))
        ) : (
          <Handle
            type="source"
            position={vertical ? Position.Bottom : Position.Right}
          />
        )}
      </article>
    </>
  );
}
function FlowEdge(props: EdgeProps) {
  const kind = String(props.data?.kind),
    connector = props.data?.connector;
  const [path, x, y] =
    connector === "straight"
      ? getStraightPath(props)
      : connector === "step" ||
          (connector === "auto" &&
            ["NAVIGATION", "SEQUENCE", "ENTRY", "COLLAPSED"].includes(kind))
        ? getSmoothStepPath({ ...props, borderRadius: 16, offset: 35 })
        : getBezierPath({ ...props, curvature: kind === "RETURN" ? 0.6 : 0.3 });
  const status = [props.data?.branchLabel, props.data?.status]
    .filter((v) => typeof v === "string" && v)
    .join(" · ");
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        style={props.style}
        markerEnd={props.markerEnd}
      />
      {status && (
        <EdgeLabelRenderer>
          <span
            className="edge-label"
            style={{
              transform: `translate(-50%,-50%) translate(${x}px,${y}px)`,
            }}
          >
            {status}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const nodeTypes = { studio: FlowNode },
  edgeTypes = { studio: FlowEdge };
export function FlowCanvas({
  graph,
  mode,
  active,
  inferred,
  confirmed,
  search,
  selected,
  onSelect,
  fitKey,
  focusKey,
  layoutKey,
  direction,
  connector,
  follow,
  followNode,
  spotlight,
  branchSteps,
  onManualPan,
}: {
  graph: FlowGraphPayload;
  mode: RoleViewMode;
  active: Set<string>;
  inferred: Set<string>;
  confirmed: Set<string>;
  search: string;
  selected: string | null;
  onSelect: (id: string | null) => void;
  fitKey: number;
  focusKey: number;
  layoutKey: number;
  direction: Direction;
  connector: ConnectorStyle;
  follow: boolean;
  followNode?: string;
  spotlight: boolean;
  branchSteps: Map<string, number>;
  onManualPan: () => void;
}) {
  const [positions, setPositions] = useState(
    new Map<string, { x: number; y: number }>(),
  );
  const [sizes, setSizes] = useState(new Map<string, Size>());
  const sizeRef = useRef(sizes);
  sizeRef.current = sizes;
  const [error, setError] = useState(""),
    [ready, setReady] = useState(0),
    [loading, setLoading] = useState(true);
  const flow = useReactFlow();
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    layout(graph, direction, sizeRef.current)
      .catch(() => {
        if (!cancelled)
          setError("Không thể tự dàn trang. Kéo node để sắp xếp thủ công.");
        return new Map(
          graph.nodes.map((n, i) => [
            n.id,
            { x: (i % 3) * 360, y: Math.floor(i / 3) * 250 },
          ]),
        );
      })
      .then((p) => {
        if (!cancelled) {
          setPositions(p);
          setReady((v) => v + 1);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [graph, direction, layoutKey]);
  const visibleRef = useRef(graph);
  visibleRef.current = graph;
  const selectionRef = useRef(selected);
  selectionRef.current = selected;
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const g = visibleRef.current;
      const anchor =
        g.nodes.find((n) => n.id === selectionRef.current) ??
        g.nodes.find((n) => n.routeInfo?.isInitialRoute) ??
        g.nodes[0];
      if (anchor)
        void flow.fitView({
          nodes: [{ id: anchor.id }],
          minZoom: 0.85,
          maxZoom: 0.85,
          duration: 0,
        });
    }, 80);
    return () => clearTimeout(t);
  }, [ready, focusKey, flow]);
  useEffect(() => {
    if (!fitKey) return;
    const t = setTimeout(
      () =>
        void flow.fitView({
          padding: 0.15,
          minZoom: 0.08,
          maxZoom: 1,
          duration: 0,
        }),
      80,
    );
    return () => clearTimeout(t);
  }, [fitKey, flow]);
  const focusedNodes = useMemo(() => {
    const ids = new Set<string>();
    if (selected) ids.add(selected);
    if (followNode) ids.add(followNode);
    for (const e of graph.edges)
      if (
        edgeHasEvidence(e, active) ||
        e.source === selected ||
        e.target === selected
      ) {
        ids.add(e.source);
        ids.add(e.target);
      }
    return ids;
  }, [graph, selected, active, followNode]);
  useEffect(() => {
    if (
      !follow ||
      !followNode ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const p = positions.get(followNode),
      size = sizes.get(followNode) ?? nodeSize;
    if (p)
      void flow.setCenter(p.x + size.width / 2, p.y + size.height / 2, {
        zoom: 1,
        duration: 200,
      });
  }, [follow, followNode, positions, sizes, flow]);
  const nodes = useMemo<StudioNode[]>(
    () =>
      graph.nodes.map((n, i) => {
        const size = sizes.get(n.id) ?? nodeSize;
        return {
          id: n.id,
          type: "studio",
          dragHandle: ".node-kind",
          data: {
            node: n,
            mode,
            direction,
            size,
            resize: (next) => setSizes((prev) => new Map(prev).set(n.id, next)),
            highlighted: spotlight && focusedNodes.has(n.id),
          },
          position: positions.get(n.id) ?? {
            x: (i % 3) * 360,
            y: Math.floor(i / 3) * 250,
          },
          selected: n.id === selected,
          width: size.width,
          height: size.height,
          style: {
            width: size.width,
            height: size.height,
            opacity:
              search &&
              !`${n.technicalTitle} ${n.businessTitle} ${n.routeInfo?.routePath ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase())
                ? 0.18
                : 1,
          },
          ariaLabel: `${n.kind}: ${mode === "DEV" ? n.technicalTitle : n.businessTitle}`,
        };
      }),
    [
      graph,
      positions,
      sizes,
      mode,
      direction,
      search,
      selected,
      spotlight,
      focusedNodes,
    ],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const tested =
            !!e.sourceHandle &&
            confirmed.has(branchKey(e.source, e.sourceHandle)),
          kind = edgeKind(e);
        const status = tested
          ? `${branchSteps.has(branchKey(e.source, e.sourceHandle!)) ? "#" + branchSteps.get(branchKey(e.source, e.sourceHandle!)) + " · " : ""}Tested ✓`
          : edgeHasEvidence(e, inferred)
            ? "Inferred"
            : mode === "TESTER" && e.sourceHandle
              ? "Untested"
              : undefined;
        const color =
          tested || edgeHasEvidence(e, active)
            ? "#10B981"
            : kind === "STATE"
              ? "#C4B5FD"
              : kind === "NAVIGATION"
                ? "#60A5FA"
                : kind === "BRANCH"
                  ? "#FBBF24"
                  : kind === "RETURN"
                    ? "#F9A8D4"
                    : "#94A3B8";
        return {
          ...e,
          type: "studio",
          data: {
            status,
            kind,
            connector,
            branchLabel:
              (mode === "DEV" ? e.technicalLabel : e.businessLabel) ??
              (kind === "COLLAPSED"
                ? `Qua ${e.via?.length ?? 1} bước`
                : kind === "NAVIGATION" || kind === "STATE" || kind === "RETURN"
                  ? edgeLabels[kind]
                  : undefined),
          },
          label: undefined,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 18,
            height: 18,
          },
          style: {
            stroke: color,
            strokeWidth:
              tested || edgeHasEvidence(e, active)
                ? 3
                : kind === "NAVIGATION"
                  ? 2
                  : 1.6,
            strokeDasharray:
              tested || kind === "NAVIGATION" || kind === "SEQUENCE"
                ? undefined
                : kind === "STATE"
                  ? "8 4"
                  : kind === "RETURN"
                    ? "3 4"
                    : "6 4",
          },
          animated:
            edgeHasEvidence(e, active) &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          ariaLabel: `${edgeLabels[kind]}${e.technicalLabel ? ": " + e.technicalLabel : ""}`,
        };
      }),
    [graph, mode, confirmed, inferred, active, branchSteps, connector],
  );
  function changeNodes(changes: NodeChange<StudioNode>[]) {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        const position = change.position;
        setPositions((prev) => new Map(prev).set(change.id, position));
      }
      if (
        change.type === "dimensions" &&
        change.dimensions &&
        (change.resizing || change.setAttributes)
      ) {
        const size = change.dimensions;
        setSizes((prev) => new Map(prev).set(change.id, size));
      }
      if (change.type === "select" && change.selected) onSelect(change.id);
    }
  }
  return (
    <section className="canvas" aria-label="Bản đồ luồng" aria-busy={loading}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={changeNodes}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        onNodeDragStart={onManualPan}
        nodesDraggable
        nodesConnectable={false}
        onMoveStart={(event) => {
          if (event) onManualPan();
        }}
        minZoom={0.08}
        maxZoom={3}
        colorMode="dark"
      >
        <Background gap={24} color="#334155" />
        <Controls showInteractive={false} />
        {!selected && (
          <MiniMap
            nodeColor={(n) => colors[(n.data.node as FlowNodeData).kind]}
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      <p className="canvas-hint">
        Kéo tiêu đề để di chuyển · Chọn node để kéo giãn · Cuộn để zoom
      </p>
      {error && (
        <p className="canvas-message" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
