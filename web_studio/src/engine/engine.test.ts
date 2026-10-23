import { validGraph, validEvent, readGraph } from "./validation";
import {
  contractNodes,
  screenGraph,
  neighborhood,
  withVisibleSources,
  edgeHasEvidence,
} from "./graphView";
import { describe, it, expect } from "vitest";
import type {
  FlowGraphPayload,
  FlowNodeData,
  RuntimeStepEvent,
} from "../types/graph";
import { branchKey, coverage, inferPath, matchEvent } from "./pathInference";
import { serialize, safeEvents } from "./exporters";
import { simplify } from "./lowCodeSimplifier";
import { useFlowStore } from "../store/useFlowStore";
const nodes: FlowNodeData[] = [
  {
    id: "start",
    kind: "SCREEN",
    featureGroup: "auth",
    technicalTitle: "LoginScreen",
    businessTitle: "Đăng nhập",
  },
  {
    id: "decision",
    kind: "DECISION",
    featureGroup: "auth",
    technicalTitle: "ok",
    businessTitle: "Hợp lệ?",
    decisionInfo: {
      kind: "IF_ELSE",
      rawExpression: "ok",
      humanReadableRule: "Hợp lệ?",
      branches: [
        { branchId: "true", technicalLabel: "true", businessLabel: "Đúng" },
        { branchId: "false", technicalLabel: "false", businessLabel: "Sai" },
      ],
    },
  },
  {
    id: "end",
    kind: "DIALOG",
    featureGroup: "auth",
    technicalTitle: "Error",
    businessTitle: "Lỗi",
  },
];
const graph = {
  generatedAt: "2026-10-22",
  project: {
    projectName: "test",
    description: "Fixture",
    version: "1.0.0",
    flutterSdkVersion: "3.41.9",
    dartSdkConstraint: ">=3.8.0 <4.0.0",
    detectedArchitecture: {
      stateManagement: [],
      routing: [],
      networking: [],
      localStorage: [],
    },
    allDependencies: [],
    stats: {
      totalScreens: 1,
      totalActions: 0,
      totalDecisions: 1,
      totalApis: 0,
      totalDialogs: 1,
      totalBottomSheets: 0,
    },
  },
  nodes,
  edges: [
    { id: "a", source: "start", target: "decision" },
    { id: "b", source: "decision", target: "end", sourceHandle: "false" },
  ],
  healthIssues: [],
} as FlowGraphPayload;
const event = (
  sequenceOrder: number,
  extra: Partial<RuntimeStepEvent> = {},
): RuntimeStepEvent => ({
  type: "RUNTIME_STEP",
  sessionId: "one",
  deviceName: "android",
  timestamp: 1,
  sequenceOrder,
  eventKind: "ROUTE_PUSH",
  ...extra,
});
describe("readable graph views", () => {
  it("omits unrelated full-source contexts from a scoped snapshot", () => {
    const context = {
      filePath: "lib/main.dart",
      name: "login",
      startLine: 1,
      endLine: 1,
      code: "void login(){}",
    };
    const g = {
      ...graph,
      nodes: [
        {
          ...nodes[0],
          sourceLocation: {
            filePath: "lib/main.dart",
            line: 1,
            column: 1,
            codeSnippet: "login",
            contextId: "login",
          },
        },
      ],
      edges: [],
      sourceContexts: {
        login: context,
        unrelated: { ...context, code: "private unrelated source" },
      },
    };
    const exported = withVisibleSources(g);
    expect(Object.keys(exported.sourceContexts!)).toEqual(["login"]);
    expect(JSON.stringify(exported)).not.toContain("private unrelated source");
    expect(validGraph(exported)).toBe(true);
  });
  it("never highlights a collapsed path from partial runtime evidence", () => {
    const edge = {
      id: "collapsed",
      source: "start",
      target: "end",
      viaEdges: ["a", "b"],
    };
    expect(edgeHasEvidence(edge, new Set(["a"]))).toBe(false);
    expect(edgeHasEvidence(edge, new Set(["a", "b"]))).toBe(true);
  });
  it("contracts a chain with a hidden cycle and preserves navigation between screens", () => {
    const g = {
      ...graph,
      nodes: [
        nodes[0],
        { ...nodes[0], id: "home", technicalTitle: "HomeScreen" },
        ...["a", "b"].map((id) => ({
          ...nodes[1],
          id,
          kind: "ACTION" as const,
          decisionInfo: undefined,
        })),
      ],
      edges: [
        { id: "1", source: "start", target: "a" },
        { id: "2", source: "a", target: "b" },
        { id: "3", source: "b", target: "a" },
        { id: "4", source: "b", target: "home" },
      ],
    };
    const result = screenGraph(g);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({ source: "start", target: "home" });
    expect(result.edges[0].via).toEqual(["a", "b"]);
  });
  it("retains decision handles and labels across hidden plumbing", () => {
    const middle = { ...nodes[0], id: "middle", kind: "ACTION" as const };
    const result = contractNodes(
      {
        ...graph,
        nodes: [...nodes, middle],
        edges: [
          {
            id: "a",
            source: "decision",
            target: "middle",
            sourceHandle: "false",
            businessLabel: "Sai",
          },
          { id: "b", source: "middle", target: "end" },
        ],
      },
      new Set(["middle"]),
    );
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      source: "decision",
      target: "end",
      sourceHandle: "false",
      businessLabel: "Sai",
      kind: "COLLAPSED",
    });
  });
  it("limits the selected neighborhood without losing its incident links", () => {
    const result = neighborhood(graph, "start", 1);
    expect(result.nodes.map((n) => n.id)).toEqual(["start", "decision"]);
    expect(result.edges.map((e) => e.id)).toEqual(["a"]);
    expect(neighborhood(graph, null)).toBe(graph);
  });
  it("migrates old logout and grouped overlay snapshots without changing IDs", () => {
    const parsed = readGraph({
      ...graph,
      nodes: [
        { ...nodes[0], kind: "LOGOUT" },
        {
          ...nodes[2],
          dialogInfo: {
            overlayType: "BOTTOM_SHEET",
            widgetName: "Options",
            actions: [],
          },
        },
      ],
      edges: [],
    });
    expect(parsed?.nodes.map((n) => n.kind)).toEqual(["ACTION", "BOTTOMSHEET"]);
    expect(parsed?.nodes.map((n) => n.id)).toEqual(["start", "end"]);
    expect(parsed?.project.stats).not.toHaveProperty("totalLogoutPoints");
  });
  it("rejects invalid or missing full-source references", () => {
    const sourceLocation = {
      filePath: "lib/main.dart",
      line: 1,
      column: 1,
      codeSnippet: "snippet",
      contextId: "method",
    };
    const g = {
      ...graph,
      nodes: [{ ...nodes[0], sourceLocation }],
      edges: [],
      sourceContexts: {
        method: {
          name: "login",
          code: "void login(){}",
          filePath: "lib/main.dart",
          startLine: 1,
          endLine: 1,
        },
      },
    };
    expect(validGraph(g)).toBe(true);
    expect(validGraph({ ...g, sourceContexts: {} })).toBe(false);
    expect(validGraph({ ...g, sourceContexts: { method: { code: 99 } } })).toBe(
      false,
    );
  });
  it("matches bottom sheets independently of dialogs with the same name", () => {
    const g = {
      ...graph,
      nodes: [
        {
          ...nodes[2],
          kind: "DIALOG" as const,
          dialogInfo: {
            overlayType: "DIALOG" as const,
            widgetName: "Options",
            actions: [],
          },
        },
        {
          ...nodes[2],
          id: "sheet",
          kind: "BOTTOMSHEET" as const,
          dialogInfo: {
            overlayType: "BOTTOM_SHEET" as const,
            widgetName: "Options",
            actions: [],
          },
        },
      ],
    };
    expect(
      matchEvent(
        g,
        event(1, { eventKind: "BOTTOM_SHEET_OPEN", routeName: "Options" }),
      ),
    ).toBe("sheet");
  });
});
describe("execution evidence", () => {
  it("infers a unique path only", () => {
    expect(inferPath(graph, "start", "end")).toEqual(["a", "b"]);
    expect(
      inferPath(
        {
          ...graph,
          edges: [...graph.edges, { id: "c", source: "start", target: "end" }],
        },
        "start",
        "end",
      ),
    ).toEqual([]);
  });
  it("handles cycles without claiming ambiguous evidence", () => {
    expect(
      inferPath(
        {
          ...graph,
          edges: [
            ...graph.edges,
            { id: "cycle", source: "decision", target: "start" },
          ],
        },
        "start",
        "end",
      ),
    ).toEqual(["a", "b"]);
  });
  it("unknown or ambiguous event mapping remains unmatched", () => {
    expect(matchEvent(graph, event(1, { routeName: "LoginScreen" }))).toBe(
      "start",
    );
    expect(
      matchEvent(
        { ...graph, nodes: [...nodes, { ...nodes[0], id: "other" }] },
        event(1, { routeName: "LoginScreen" }),
      ),
    ).toBeUndefined();
  });
  it("only confirmed branch probes count toward coverage", () => {
    expect(coverage(graph, new Set())).toEqual({
      tested: 0,
      total: 2,
      percent: 0,
    });
    expect(coverage(graph, new Set([branchKey("decision", "false")]))).toEqual({
      tested: 1,
      total: 2,
      percent: 50,
    });
  });
  it("inferred paths never increase confirmed coverage and duplicate events are ignored", () => {
    const s = useFlowStore.getState();
    s.reset();
    s.setGraph(graph);
    s.receive(event(1, { matchedNodeId: "start" }));
    s.receive(event(2, { matchedNodeId: "end" }));
    s.receive(event(2, { matchedNodeId: "end" }));
    expect(useFlowStore.getState().events).toHaveLength(2);
    expect(useFlowStore.getState().inferred.has("b")).toBe(true);
    expect(useFlowStore.getState().confirmed.size).toBe(0);
    s.receive(
      event(3, {
        eventKind: "BRANCH_HIT",
        matchedNodeId: "decision",
        matchedBranchId: "false",
      }),
    );
    expect(coverage(graph, useFlowStore.getState().confirmed).tested).toBe(1);
  });
  it("does not infer across device sessions", () => {
    const s = useFlowStore.getState();
    s.reset();
    s.setGraph(graph);
    s.receive(event(1, { matchedNodeId: "start" }));
    s.receive(event(1, { sessionId: "two", matchedNodeId: "end" }));
    expect(useFlowStore.getState().inferred.size).toBe(0);
  });
});
describe("exports", () => {
  it("outputs all graph formats with nodes and edges", () => {
    for (const format of [
      "mmd",
      "drawio",
      "excalidraw",
      "puml",
      "flow.json",
    ] as const)
      expect(serialize(graph, format, true)).toContain(
        format === "mmd" || format === "puml"
          ? "n0"
          : format === "drawio"
            ? "mxCell"
            : format === "excalidraw"
              ? "arrow"
              : "graph",
      );
  });
  it("snapshot excludes payloads unless explicitly selected", () => {
    const e = event(1, {
      apiDetails: {
        method: "POST",
        url: "/login",
        requestBody: { password: "secret" },
      },
    });
    expect(JSON.stringify(safeEvents([e], false))).not.toContain("secret");
    expect(JSON.stringify(safeEvents([e], true))).toContain("secret");
  });
  it("low-code removes bridge intermediary without orphan edges", () => {
    const g = {
      ...graph,
      nodes: [
        ...nodes,
        { ...nodes[0], id: "technical", kind: "ACTION" as const },
      ],
      edges: [
        { id: "in", source: "start", target: "technical" },
        { id: "out", source: "technical", target: "end", isStateBridge: true },
      ],
    };
    const simplified = simplify(g);
    expect(simplified.nodes.some((n) => n.id === "technical")).toBe(false);
    expect(
      simplified.edges.some((e) => e.source === "start" && e.target === "end"),
    ).toBe(true);
  });
});

it("rejects structurally invalid imported graph and runtime values", () => {
  expect(validGraph(graph)).toBe(true);
  expect(validGraph({ ...graph, nodes: [...nodes, nodes[0]] })).toBe(false);
  expect(validEvent(event(1, { routeName: "LoginScreen" }))).toBe(true);
  expect(validEvent({ ...event(1), routeName: { password: "secret" } })).toBe(
    false,
  );
});

it("matches generic runtime state names to static emissions", () => {
  expect(
    matchEvent(
      {
        ...graph,
        nodes: [
          {
            ...nodes[0],
            id: "state",
            kind: "ACTION",
            technicalTitle: "AsyncData",
          },
        ],
      },
      event(1, {
        eventKind: "STATE_EMITTED",
        stateTypeName: "AsyncData<String>",
      }),
    ),
  ).toBe("state");
});

it("maps configured route names and parameterized paths without guessing another screen", () => {
  const g = {
    ...graph,
    nodes: [
      {
        ...nodes[0],
        routeInfo: {
          routePath: "/home/:id",
          isInitialRoute: false,
          parameters: ["id"],
          aliases: ["home"],
        },
      },
    ],
  };
  expect(matchEvent(g, event(1, { routeName: "/home/42" }))).toBe("start");
  expect(matchEvent(g, event(1, { routeName: "home" }))).toBe("start");
  expect(matchEvent(g, event(1, { routeName: "/home" }))).toBeUndefined();
});

it("session handshake does not report an unmapped runtime failure", () => {
  const s = useFlowStore.getState();
  s.reset();
  s.setGraph(graph);
  s.receive(event(1, { type: "SESSION_CONNECTED" }));
  expect(useFlowStore.getState().error).toBe("");
});

it("low-code hides build and repository plumbing while preserving the business path", () => {
  const g = {
    ...graph,
    nodes: [
      nodes[0],
      {
        ...nodes[0],
        id: "build",
        kind: "ACTION" as const,
        technicalTitle: "LoginScreen.build()",
      },
      {
        ...nodes[0],
        id: "repo",
        kind: "ACTION" as const,
        technicalTitle: "AuthRepository.login()",
      },
      nodes[2],
    ],
    edges: [
      { id: "1", source: "start", target: "build" },
      { id: "2", source: "build", target: "repo" },
      { id: "3", source: "repo", target: "end" },
    ],
  };
  const simple = simplify(g);
  expect(simple.nodes.map((n) => n.id)).toEqual(["start", "end"]);
  expect(
    simple.edges.some((e) => e.source === "start" && e.target === "end"),
  ).toBe(true);
});
