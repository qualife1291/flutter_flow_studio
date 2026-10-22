import { create } from "zustand";
import type {
  FlowGraphPayload,
  RuntimeStepEvent,
  RoleViewMode,
} from "../types/graph";
import { branchKey, inferPath, matchEvent } from "../engine/pathInference";
interface State {
  graph: FlowGraphPayload | null;
  mode: RoleViewMode;
  events: RuntimeStepEvent[];
  confirmed: Set<string>;
  inferred: Set<string>;
  active: Set<string>;
  selected: string | null;
  status: string;
  error: string;
  session: string | null;
  previous: Record<string, string>;
  seen: Record<string, number>;
  setGraph: (g: FlowGraphPayload) => void;
  setMode: (m: RoleViewMode) => void;
  select: (id: string | null) => void;
  receive: (e: RuntimeStepEvent) => void;
  reset: () => void;
}
export const useFlowStore = create<State>((set, get) => ({
  graph: null,
  mode: "DEV",
  events: [],
  confirmed: new Set(),
  inferred: new Set(),
  active: new Set(),
  selected: null,
  status: "Chưa kết nối",
  error: "",
  session: null,
  previous: {},
  seen: {},
  setGraph: (graph) => set({ graph }),
  setMode: (mode) => set({ mode }),
  select: (selected) => set({ selected }),
  reset: () =>
    set({
      events: [],
      confirmed: new Set(),
      inferred: new Set(),
      active: new Set(),
      previous: {},
      seen: {},
      session: null,
      error: "",
    }),
  receive: (event) => {
    const s = get();
    if (!s.graph) return;
    if (event.type === "SESSION_RESET") {
      get().reset();
      return;
    }
    if (event.sequenceOrder <= (s.seen[event.sessionId] ?? -1)) return;
    const matched = matchEvent(s.graph, event);
    const confirmed = new Set(s.confirmed),
      inferred = new Set(s.inferred),
      active = new Set(s.active);
    if (
      event.eventKind === "BRANCH_HIT" &&
      event.matchedNodeId &&
      event.matchedBranchId
    ) {
      const node = s.graph.nodes.find((n) => n.id === event.matchedNodeId);
      if (
        node?.decisionInfo?.branches.some(
          (b) => b.branchId === event.matchedBranchId,
        )
      )
        confirmed.add(branchKey(node.id, event.matchedBranchId));
    }
    if (matched) {
      if (s.previous[event.sessionId])
        for (const id of inferPath(
          s.graph,
          s.previous[event.sessionId],
          matched,
        )) {
          inferred.add(id);
          active.add(id);
        }
      for (const edge of s.graph.edges)
        if (
          edge.source === matched &&
          edge.sourceHandle &&
          confirmed.has(branchKey(edge.source, edge.sourceHandle))
        )
          active.add(edge.id);
    }
    set({
      events: [...s.events, event].slice(-2000),
      confirmed,
      inferred,
      active,
      session: event.sessionId,
      seen: { ...s.seen, [event.sessionId]: event.sequenceOrder },
      previous: matched
        ? { ...s.previous, [event.sessionId]: matched }
        : s.previous,
      error: matched
        ? ""
        : "Không ánh xạ được bước này. Dùng FlowProbe với ID node để đánh dấu chính xác.",
    });
  },
}));
