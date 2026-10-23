import type { FlowGraphPayload, RuntimeStepEvent } from "../types/graph";
import { colors } from "../theme/tokens";
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const string = (x: unknown): x is string => typeof x === "string";
export function validGraph(value: unknown): value is FlowGraphPayload {
  if (
    !object(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    !Array.isArray(value.healthIssues) ||
    !object(value.project) ||
    value.nodes.length > 10000
  )
    return false;
  const g = {
      nodes: value.nodes,
      edges: value.edges,
      healthIssues: value.healthIssues,
    },
    project = value.project;
  if (
    value.sourceContexts != null &&
    (!object(value.sourceContexts) ||
      !Object.values(value.sourceContexts).every(
        (c) =>
          object(c) &&
          string(c.code) &&
          string(c.name) &&
          string(c.filePath) &&
          Number.isInteger(c.startLine) &&
          Number.isInteger(c.endLine),
      ))
  )
    return false;
  if (
    ![
      "projectName",
      "description",
      "version",
      "flutterSdkVersion",
      "dartSdkConstraint",
    ].every((k) => string(project[k])) ||
    !object(project.stats) ||
    !Object.values(project.stats).every(
      (v) => typeof v === "number" && Number.isFinite(v),
    ) ||
    !Array.isArray(project.allDependencies) ||
    !project.allDependencies.every(
      (d) => object(d) && string(d.name) && string(d.version),
    )
  )
    return false;
  if (project.projectRoot != null && typeof project.projectRoot !== "string")
    return false;
  const ids = new Set(g.nodes.map((n) => (object(n) ? n.id : undefined)));
  return (
    ids.size === g.nodes.length &&
    g.nodes.every(
      (n) =>
        object(n) &&
        string(n.id) &&
        string(n.kind) &&
        Object.hasOwn(colors, n.kind) &&
        string(n.featureGroup) &&
        string(n.technicalTitle) &&
        string(n.businessTitle) &&
        (!n.sourceLocation ||
          (object(n.sourceLocation) &&
            string(n.sourceLocation.filePath) &&
            typeof n.sourceLocation.line === "number" &&
            string(n.sourceLocation.codeSnippet) &&
            (n.sourceLocation.contextId == null ||
              (string(n.sourceLocation.contextId) &&
                object(value.sourceContexts) &&
                Object.hasOwn(
                  value.sourceContexts,
                  n.sourceLocation.contextId,
                ))))) &&
        (!n.decisionInfo ||
          (object(n.decisionInfo) &&
            Array.isArray(n.decisionInfo.branches) &&
            n.decisionInfo.branches.every(
              (b) =>
                object(b) &&
                string(b.branchId) &&
                string(b.technicalLabel) &&
                string(b.businessLabel),
            ))) &&
        (!n.apiInfo ||
          (object(n.apiInfo) &&
            string(n.apiInfo.method) &&
            string(n.apiInfo.endpoint))) &&
        (!n.routeInfo ||
          (object(n.routeInfo) &&
            string(n.routeInfo.routePath) &&
            (n.routeInfo.router == null || string(n.routeInfo.router)) &&
            (n.routeInfo.aliases == null ||
              (Array.isArray(n.routeInfo.aliases) &&
                n.routeInfo.aliases.every(string))))) &&
        (!n.dialogInfo ||
          (object(n.dialogInfo) && string(n.dialogInfo.widgetName))),
    ) &&
    g.edges.every(
      (e) =>
        object(e) &&
        string(e.id) &&
        ids.has(e.source) &&
        ids.has(e.target) &&
        (e.kind == null ||
          [
            "ENTRY",
            "CALL",
            "RETURN",
            "SEQUENCE",
            "NAVIGATION",
            "BRANCH",
            "STATE",
            "COLLAPSED",
          ].includes(String(e.kind))) &&
        (e.via == null || (Array.isArray(e.via) && e.via.every(string))) &&
        (e.viaEdges == null ||
          (Array.isArray(e.viaEdges) && e.viaEdges.every(string))),
    ) &&
    g.healthIssues.every(
      (i) =>
        object(i) &&
        ["id", "nodeId", "title", "suggestionForBA", "suggestionForDev"].every(
          (k) => string(i[k]),
        ),
    )
  );
}

/** Existing snapshots retain IDs/probes while using the new node taxonomy. */
export function readGraph(value: unknown): FlowGraphPayload | null {
  if (!object(value) || !Array.isArray(value.nodes)) return null;
  const nodes = value.nodes.map((n) => {
    if (!object(n)) return n;
    if (n.kind === "LOGOUT") return { ...n, kind: "ACTION" };
    if (n.kind === "DIALOG" && object(n.dialogInfo)) {
      const kind = (
        {
          BOTTOM_SHEET: "BOTTOMSHEET",
          SNACKBAR: "SNACKBAR",
          TOAST: "TOAST",
        } as Record<string, string>
      )[String(n.dialogInfo.overlayType)];
      if (kind) return { ...n, kind };
    }
    return n;
  });
  const result = { ...value, nodes };
  if (!validGraph(result)) return null;
  const kinds = {
    totalScreens: "SCREEN",
    totalActions: "ACTION",
    totalDecisions: "DECISION",
    totalApis: "API",
    totalDialogs: "DIALOG",
    totalBottomSheets: "BOTTOMSHEET",
    totalSnackbars: "SNACKBAR",
    totalToasts: "TOAST",
  };
  return {
    ...result,
    project: {
      ...result.project,
      stats: Object.fromEntries(
        Object.entries(kinds).map(([key, kind]) => [
          key,
          nodes.filter((n) => object(n) && n.kind === kind).length,
        ]),
      ) as FlowGraphPayload["project"]["stats"],
    },
  };
}

export function validEvent(value: unknown): value is RuntimeStepEvent {
  if (
    !object(value) ||
    !["RUNTIME_STEP", "SESSION_CONNECTED", "SESSION_RESET"].includes(
      String(value.type),
    ) ||
    !string(value.sessionId) ||
    !string(value.deviceName) ||
    typeof value.timestamp !== "number" ||
    !Number.isFinite(value.timestamp) ||
    !Number.isInteger(value.sequenceOrder) ||
    ![
      "ROUTE_PUSH",
      "ROUTE_POP",
      "ROUTE_REPLACE",
      "DIALOG_OPEN",
      "BOTTOM_SHEET_OPEN",
      "SNACKBAR_SHOW",
      "API_REQUEST",
      "API_RESPONSE",
      "STATE_EMITTED",
      "BRANCH_HIT",
      "LOGOUT_TRIGGERED",
    ].includes(String(value.eventKind))
  )
    return false;
  if (
    !["matchedNodeId", "matchedBranchId", "routeName", "stateTypeName"].every(
      (key) => value[key] == null || string(value[key]),
    )
  )
    return false;
  if (
    value.apiDetails != null &&
    (!object(value.apiDetails) ||
      !string(value.apiDetails.url) ||
      !string(value.apiDetails.method))
  )
    return false;
  return true;
}
