import type { FlowGraphPayload, FlowEdgeData } from "../types/graph";
export type DetailLevel = "overview" | "screens" | "all";

/** Contract hidden intermediaries without fabricating confirmed execution evidence. */
export function contractNodes(
  graph: FlowGraphPayload,
  hidden: Set<string>,
): FlowGraphPayload {
  const edges = new Map(graph.edges.map((e) => [e.id, e]));
  for (const id of hidden) {
    const incoming = [...edges.values()].filter(
      (e) => e.target === id && e.source !== id,
    );
    const outgoing = [...edges.values()].filter(
      (e) => e.source === id && e.target !== id,
    );
    for (const a of incoming)
      for (const b of outgoing) {
        if (a.source === b.target) continue;
        const key = `collapsed:${a.source}:${a.sourceHandle ?? ""}:${b.target}`;
        const via = [...new Set([...(a.via ?? []), id, ...(b.via ?? [])])];
        const edge: FlowEdgeData = {
          ...a,
          id: key,
          target: b.target,
          kind: "COLLAPSED",
          via,
          viaEdges: [...(a.viaEdges ?? [a.id]), ...(b.viaEdges ?? [b.id])],
          isStateBridge: a.isStateBridge || b.isStateBridge,
        };
        if (!edges.has(key)) edges.set(key, edge);
      }
    for (const [key, e] of edges)
      if (e.source === id || e.target === id) edges.delete(key);
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => !hidden.has(n.id)),
    edges: [...edges.values()],
    healthIssues: graph.healthIssues.filter((i) => !hidden.has(i.nodeId)),
  };
}

export function screenGraph(graph: FlowGraphPayload) {
  const result = contractNodes(
    graph,
    new Set(graph.nodes.filter((n) => n.kind !== "SCREEN").map((n) => n.id)),
  );
  return {
    ...result,
    edges: result.edges.map((e) => ({ ...e, kind: "NAVIGATION" as const })),
  };
}

export function edgeHasEvidence(edge: FlowEdgeData, evidence: Set<string>) {
  return (
    evidence.has(edge.id) ||
    (!!edge.viaEdges?.length && edge.viaEdges.every((id) => evidence.has(id)))
  );
}

export function withVisibleSources(graph: FlowGraphPayload): FlowGraphPayload {
  const contexts = graph.sourceContexts;
  if (!contexts) return graph;
  const ids = new Set(graph.nodes.map((n) => n.sourceLocation?.contextId));
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  return {
    ...graph,
    sourceContexts: Object.fromEntries(
      Object.entries(contexts).filter(([id]) => ids.has(id)),
    ),
    healthIssues: graph.healthIssues.filter((i) => nodeIds.has(i.nodeId)),
  };
}

export function neighborhood(
  graph: FlowGraphPayload,
  selected: string | null,
  depth = 1,
): FlowGraphPayload {
  if (!selected || !graph.nodes.some((n) => n.id === selected)) return graph;
  const ids = new Set([selected]);
  for (let i = 0; i < depth; i++) {
    const next = new Set(ids);
    for (const e of graph.edges)
      if (ids.has(e.source) || ids.has(e.target)) {
        next.add(e.source);
        next.add(e.target);
      }
    for (const id of next) ids.add(id);
  }
  return {
    ...graph,
    nodes: graph.nodes.filter((n) => ids.has(n.id)),
    edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    healthIssues: graph.healthIssues.filter((i) => ids.has(i.nodeId)),
  };
}

export const edgeLabels = {
  ENTRY: "Điểm vào",
  CALL: "Gọi hàm",
  RETURN: "Trả kết quả",
  SEQUENCE: "Tiếp theo",
  NAVIGATION: "Điều hướng",
  BRANCH: "Nhánh",
  STATE: "Thay đổi trạng thái",
  COLLAPSED: "Qua bước ẩn",
};
export function edgeKind(e: FlowEdgeData) {
  return (
    e.kind ??
    (e.isStateBridge ? "STATE" : e.sourceHandle ? "BRANCH" : "SEQUENCE")
  );
}
