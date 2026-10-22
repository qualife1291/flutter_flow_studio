import type { FlowGraphPayload, RuntimeStepEvent } from "../../types/graph";
export type Format = "drawio" | "mmd" | "excalidraw" | "puml" | "flow.json";
const xml = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
export function serialize(
  graph: FlowGraphPayload,
  format: Format,
  business: boolean,
  events: RuntimeStepEvent[] = [],
) {
  const ids = new Map(graph.nodes.map((n, i) => [n.id, `n${i}`]));
  const label = (n: (typeof graph.nodes)[number]) =>
    business ? n.businessTitle : n.technicalTitle;
  if (format === "flow.json")
    return JSON.stringify({ version: 1, graph, events }, null, 2);
  if (format === "mmd")
    return `flowchart LR\n${graph.nodes.map((n) => `  ${ids.get(n.id)}["${xml(label(n)).replaceAll("\n", " ")}"]`).join("\n")}\n${graph.edges.map((e) => `  ${ids.get(e.source)} --> ${ids.get(e.target)}`).join("\n")}`;
  if (format === "puml")
    return `@startuml\n${graph.nodes.map((n) => `rectangle "${label(n).replaceAll('"', "'").replaceAll("\n", " ")}" as ${ids.get(n.id)}`).join("\n")}\n${graph.edges.map((e) => `${ids.get(e.source)} --> ${ids.get(e.target)}`).join("\n")}\n@enduml`;
  if (format === "drawio")
    return `<mxfile><diagram name="Flow"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${graph.nodes.map((n, i) => `<mxCell id="${ids.get(n.id)}" value="${xml(label(n))}" vertex="1" parent="1" style="rounded=1;fillColor=#111827;fontColor=#ffffff"><mxGeometry x="${(i % 4) * 300}" y="${Math.floor(i / 4) * 140}" width="260" height="90" as="geometry"/></mxCell>`).join("")}${graph.edges.map((e, i) => `<mxCell id="e${i}" edge="1" parent="1" source="${ids.get(e.source)}" target="${ids.get(e.target)}"><mxGeometry relative="1" as="geometry"/></mxCell>`).join("")}</root></mxGraphModel></diagram></mxfile>`;
  const elements: unknown[] = [];
  for (const [i, n] of graph.nodes.entries()) {
    const x = (i % 4) * 320,
      y = Math.floor(i / 4) * 170;
    elements.push({
      id: ids.get(n.id),
      type: "rectangle",
      x,
      y,
      width: 280,
      height: 110,
      angle: 0,
      strokeColor: "#1971c2",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      index: `a${i}`,
      roundness: { type: 3 },
      seed: i + 1,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
    });
    elements.push({
      id: `label-${i}`,
      type: "text",
      x: x + 12,
      y: y + 20,
      width: 250,
      height: 70,
      angle: 0,
      strokeColor: "#111827",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: i + 100,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      text: label(n),
      fontSize: 16,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: label(n),
      autoResize: true,
      lineHeight: 1.25,
    });
  }
  for (const [i, e] of graph.edges.entries()) {
    const a = graph.nodes.findIndex((n) => n.id === e.source),
      b = graph.nodes.findIndex((n) => n.id === e.target);
    const x = (a % 4) * 320 + 280,
      y = Math.floor(a / 4) * 170 + 55,
      dx = (b % 4) * 320 - x,
      dy = Math.floor(b / 4) * 170 + 55 - y;
    elements.push({
      id: `edge-${i}`,
      type: "arrow",
      x,
      y,
      width: Math.abs(dx),
      height: Math.abs(dy),
      angle: 0,
      strokeColor: "#495057",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      frameId: null,
      roundness: null,
      seed: i + 1000,
      version: 1,
      versionNonce: 1,
      isDeleted: false,
      boundElements: null,
      updated: 1,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [dx, dy],
      ],
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
    });
  }
  return JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "flutter_flow_studio",
      elements,
      appState: { viewBackgroundColor: "#ffffff" },
      files: {},
    },
    null,
    2,
  );
}
export function safeEvents(
  events: RuntimeStepEvent[],
  includePayload: boolean,
) {
  return events.map((e) => {
    const { customPayload: _, apiDetails, ...rest } = e;
    return {
      ...rest,
      ...(apiDetails
        ? {
            apiDetails: {
              method: apiDetails.method,
              url: apiDetails.url,
              statusCode: apiDetails.statusCode,
              durationMs: apiDetails.durationMs,
              ...(includePayload
                ? {
                    requestBody: apiDetails.requestBody,
                    responseBody: apiDetails.responseBody,
                  }
                : {}),
            },
          }
        : {}),
    };
  });
}
export function download(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
