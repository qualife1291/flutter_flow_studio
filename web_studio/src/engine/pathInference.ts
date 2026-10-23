import type {
  FlowGraphPayload,
  RuntimeStepEvent,
  FlowNodeData,
} from "../types/graph";
export function matchEvent(
  graph: FlowGraphPayload,
  event: RuntimeStepEvent,
): string | undefined {
  if (
    event.matchedNodeId &&
    graph.nodes.some((n) => n.id === event.matchedNodeId)
  )
    return event.matchedNodeId;
  let candidates: FlowNodeData[] = [];
  if (event.routeName)
    candidates = graph.nodes.filter(
      (n) =>
        n.kind === "SCREEN" &&
        ((n.routeInfo &&
          routeMatches(n.routeInfo.routePath, event.routeName!)) ||
          n.routeInfo?.aliases?.some((alias) =>
            routeMatches(alias, event.routeName!),
          ) ||
          n.technicalTitle === event.routeName ||
          (event.routeName === "/" && n.routeInfo?.isInitialRoute)),
    );
  if (event.apiDetails)
    candidates = graph.nodes.filter(
      (n) =>
        n.kind === "API" &&
        n.apiInfo?.method === event.apiDetails!.method &&
        n.apiInfo?.endpoint === safePath(event.apiDetails!.url),
    );
  if (event.stateTypeName)
    candidates = graph.nodes.filter(
      (n) =>
        n.kind === "ACTION" &&
        n.technicalTitle === event.stateTypeName!.replace(/<.*>$/, ""),
    );
  if (
    ["DIALOG_OPEN", "BOTTOM_SHEET_OPEN", "SNACKBAR_SHOW"].includes(
      event.eventKind,
    )
  )
    candidates = graph.nodes.filter(
      (n) =>
        n.kind ===
          (
            {
              DIALOG_OPEN: "DIALOG",
              BOTTOM_SHEET_OPEN: "BOTTOMSHEET",
              SNACKBAR_SHOW: "SNACKBAR",
            } as Record<string, string>
          )[event.eventKind] && n.dialogInfo?.widgetName === event.routeName,
    );
  return candidates.length === 1 ? candidates[0].id : undefined;
}
function safePath(url: string) {
  try {
    return new URL(url, "http://local").pathname;
  } catch {
    return url;
  }
}
/** Infer only a single possible simple path. Ambiguous alternatives are never counted as tested. */
export function inferPath(
  graph: FlowGraphPayload,
  from: string,
  to: string,
): string[] {
  if (from === to) return [];
  const paths: string[][] = [];
  const outgoing = new Map<string, typeof graph.edges>();
  for (const edge of graph.edges)
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge]);
  let budget = 10000;
  function visit(node: string, path: string[], seen: Set<string>) {
    if (--budget <= 0 || paths.length > 1 || path.length > 100) return;
    if (node === to) {
      paths.push(path);
      return;
    }
    for (const edge of outgoing.get(node) ?? [])
      if (!seen.has(edge.target))
        visit(edge.target, [...path, edge.id], new Set([...seen, edge.target]));
  }
  visit(from, [], new Set([from]));
  return budget > 0 && paths.length === 1 ? paths[0] : [];
}
export function branchKey(node: string, branch: string) {
  return `${node}\0${branch}`;
}
export function coverage(graph: FlowGraphPayload, confirmed: Set<string>) {
  const branches = graph.nodes.flatMap(
    (n) =>
      n.decisionInfo?.branches.map((b) => branchKey(n.id, b.branchId)) ?? [],
  );
  const tested = branches.filter((b) => confirmed.has(b)).length;
  return {
    tested,
    total: branches.length,
    percent: branches.length
      ? Math.round((tested / branches.length) * 100)
      : null,
  };
}

function routeMatches(pattern: string, name: string) {
  const expression = pattern
    .split("/")
    .map((part) =>
      part.startsWith(":")
        ? "[^/]+"
        : part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${expression}$`).test(name);
}
