import type { FlowGraphPayload } from "../types/graph";
import { contractNodes } from "./graphView";
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
      (node.isTechnical ||
        /\.(build|initState|dispose)\(\)$/.test(node.technicalTitle) ||
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
  return contractNodes(graph, hidden);
}
