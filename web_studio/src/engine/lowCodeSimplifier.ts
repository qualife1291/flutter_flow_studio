import type { FlowGraphPayload } from "../types/graph";
export function simplify(graph: FlowGraphPayload): FlowGraphPayload {
  const hidden = new Set(
    graph.edges
      .filter((e) => e.isStateBridge)
      .flatMap((e) => [e.source])
      .filter((id) => graph.nodes.find((n) => n.id === id)?.kind === "ACTION"),
  );
  for (const node of graph.nodes) {
    if (
      node.kind === "ACTION" &&
      (/\.(build|initState|dispose)\(\)$/.test(node.technicalTitle) ||
        /\w*(Repository|DataSource|Service|Api|API|Client)\./.test(
          node.technicalTitle,
        ))
    )
      hidden.add(node.id);
    if (
      node.kind === "DECISION" &&
      (/^!?mounted$/.test(node.decisionInfo?.rawExpression ?? "") ||
        graph.edges.some((e) => e.target === node.id && e.isStateBridge))
    )
      hidden.add(node.id);
  }
  const edges = [...graph.edges];
  for (const id of hidden)
    for (const incoming of edges.filter((e) => e.target === id))
      for (const outgoing of edges.filter((e) => e.source === id)) {
        if (incoming.source !== outgoing.target)
          edges.push({
            ...incoming,
            id: `collapsed:${incoming.id}:${outgoing.id}`,
            target: outgoing.target,
            isStateBridge: false,
          });
      }
  return {
    ...graph,
    healthIssues: graph.healthIssues.filter((i) => !hidden.has(i.nodeId)),
    nodes: graph.nodes.filter((n) => !hidden.has(n.id)),
    edges: edges.filter((e) => !hidden.has(e.source) && !hidden.has(e.target)),
  };
}
