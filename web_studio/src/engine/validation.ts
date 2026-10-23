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
            string(n.sourceLocation.codeSnippet))) &&
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
            (n.routeInfo.aliases == null ||
              (Array.isArray(n.routeInfo.aliases) &&
                n.routeInfo.aliases.every(string))))) &&
        (!n.dialogInfo ||
          (object(n.dialogInfo) && string(n.dialogInfo.widgetName))),
    ) &&
    g.edges.every(
      (e) =>
        object(e) && string(e.id) && ids.has(e.source) && ids.has(e.target),
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
