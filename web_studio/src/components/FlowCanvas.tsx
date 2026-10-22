import { useEffect, useMemo, useState } from "react";
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
  useReactFlow,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
} from "@xyflow/react";
import {
  Smartphone,
  Zap,
  GitBranch,
  Globe,
  MessageSquare,
  LogOut,
} from "lucide-react";
import type {
  FlowGraphPayload,
  FlowNodeData,
  RoleViewMode,
} from "../types/graph";
import { layout } from "../engine/elkLayout";
import { colors } from "../theme/tokens";
import { branchKey } from "../engine/pathInference";
const icons = {
  SCREEN: Smartphone,
  ACTION: Zap,
  DECISION: GitBranch,
  API: Globe,
  DIALOG: MessageSquare,
  LOGOUT: LogOut,
};
type StudioNode = Node<{ node: FlowNodeData; mode: RoleViewMode }>;
function FlowNode({ data, selected }: NodeProps<StudioNode>) {
  const n = data.node,
    Icon = icons[n.kind];
  return (
    <article
      className={`flow-node ${selected ? "selected" : ""}`}
      style={{ borderColor: colors[n.kind] }}
    >
      <Handle type="target" position={Position.Left} />
      <div className="node-kind" style={{ background: colors[n.kind] }}>
        <Icon size={16} aria-hidden="true" />
        {n.kind}
      </div>
      <strong>
        {data.mode === "DEV" ? n.technicalTitle : n.businessTitle}
      </strong>
      {n.apiInfo && (
        <small>
          {n.apiInfo.method} {n.apiInfo.endpoint}
        </small>
      )}
      {n.decisionInfo ? (
        n.decisionInfo.branches.map((b, i) => (
          <Handle
            key={b.branchId}
            type="source"
            id={b.branchId}
            position={Position.Right}
            style={{
              top: `${25 + (60 * i) / Math.max(1, n.decisionInfo!.branches.length - 1)}%`,
            }}
            role="img"
            aria-label={b.businessLabel}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </article>
  );
}
function FlowEdge(props: EdgeProps) {
  const [path, x, y] = getBezierPath(props);
  const status = props.data?.status as string | undefined;
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
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
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
}) {
  const [positions, setPositions] = useState(
    new Map<string, { x: number; y: number }>(),
  );
  const [error, setError] = useState("");
  const flow = useReactFlow();
  useEffect(() => {
    let cancelled = false;
    layout(graph)
      .then((p) => {
        if (!cancelled) setPositions(p);
      })
      .catch(() =>
        setError("Không thể tự dàn trang. Các node được xếp theo danh sách."),
      );
    return () => {
      cancelled = true;
    };
  }, [graph]);
  useEffect(() => {
    if (positions.size) {
      const t = setTimeout(
        () => flow.fitView({ duration: 0, padding: 0.2 }),
        80,
      );
      return () => clearTimeout(t);
    }
  }, [positions, fitKey, flow]);
  const nodes = useMemo<StudioNode[]>(
    () =>
      graph.nodes.map((n, i) => ({
        id: n.id,
        type: "studio",
        data: { node: n, mode },
        position: positions.get(n.id) ?? {
          x: (i % 4) * 320,
          y: Math.floor(i / 4) * 160,
        },
        selected: n.id === selected,
        style: {
          opacity:
            search &&
            !`${n.technicalTitle} ${n.businessTitle}`
              .toLowerCase()
              .includes(search.toLowerCase())
              ? 0.18
              : 1,
        },
        ariaLabel: `${n.kind}: ${mode === "DEV" ? n.technicalTitle : n.businessTitle}`,
      })),
    [graph, positions, mode, search, selected],
  );
  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const tested =
          !!e.sourceHandle &&
          confirmed.has(branchKey(e.source, e.sourceHandle));
        const status = tested
          ? "Tested ✓"
          : inferred.has(e.id)
            ? "Inferred"
            : mode === "TESTER" && e.sourceHandle
              ? "Untested"
              : undefined;
        return {
          ...e,
          type: "studio",
          data: { status },
          label: undefined,
          style: {
            stroke:
              tested || active.has(e.id)
                ? "#10B981"
                : e.sourceHandle
                  ? "#F59E0B"
                  : "#94A3B8",
            strokeWidth: tested || active.has(e.id) ? 3 : 1.5,
            strokeDasharray: tested ? undefined : "6 4",
          },
          animated:
            active.has(e.id) &&
            !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        };
      }),
    [graph, mode, confirmed, inferred, active],
  );
  return (
    <section className="canvas" aria-label="Bản đồ luồng">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        nodesDraggable={false}
        minZoom={0.1}
        maxZoom={2}
        colorMode="dark"
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={20} color="#334155" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => colors[(n.data.node as FlowNodeData).kind]}
          pannable
          zoomable
        />
      </ReactFlow>
      {error && (
        <p className="canvas-message" role="status">
          {error}
        </p>
      )}
    </section>
  );
}
