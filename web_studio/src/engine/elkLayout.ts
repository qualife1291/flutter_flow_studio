import type { FlowGraphPayload } from "../types/graph";
import workerUrl from "elkjs/lib/elk-worker.min.js?url";
export type Direction = "DOWN" | "RIGHT";
export const nodeSize = { width: 300, height: 190 };
export async function layout(
  graph: FlowGraphPayload,
  direction: Direction = "DOWN",
  sizes?: Map<string, { width: number; height: number }>,
) {
  const { default: ELK } = await import("elkjs/lib/elk-api.js");
  const elk = new ELK({ workerUrl });
  try {
    const result = await elk.layout({
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": direction,
        "elk.spacing.nodeNode": "60",
        "elk.layered.spacing.nodeNodeBetweenLayers": "100",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      },
      children: graph.nodes.map((n) => ({
        id: n.id,
        ...(sizes?.get(n.id) ?? nodeSize),
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    });
    return new Map(
      result.children?.map((n) => [n.id, { x: n.x ?? 0, y: n.y ?? 0 }]) ?? [],
    );
  } finally {
    elk.terminateWorker();
  }
}
