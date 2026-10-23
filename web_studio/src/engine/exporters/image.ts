import { layout, nodeSize } from "../elkLayout";
import { edgeKind } from "../graphView";
import type { FlowGraphPayload } from "../../types/graph";
import { colors } from "../../theme/tokens";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
/** Image exports use the selected graph, rather than a screenshot of unrelated UI. */
export async function imageData(
  graph: FlowGraphPayload,
  business: boolean,
  light: boolean,
  format: "png" | "svg",
) {
  const positions = await layout(graph);
  const width = Math.max(
      600,
      ...[...positions.values()].map((p) => p.x + nodeSize.width + 40),
    ),
    height = Math.max(
      200,
      ...[...positions.values()].map((p) => p.y + nodeSize.height + 40),
    );
  const lines = graph.edges
    .map((e) => {
      const a = positions.get(e.source),
        b = positions.get(e.target);
      if (!a || !b) return "";
      const sx = a.x + 20 + nodeSize.width / 2,
        sy = a.y + 20 + nodeSize.height,
        tx = b.x + 20 + nodeSize.width / 2,
        ty = b.y + 20,
        middle = (sy + ty) / 2;
      const kind = edgeKind(e),
        color = light
          ? "#475569"
          : kind === "NAVIGATION"
            ? "#60A5FA"
            : kind === "STATE"
              ? "#C4B5FD"
              : kind === "BRANCH"
                ? "#FBBF24"
                : "#94a3b8";
      const label = (business ? e.businessLabel : e.technicalLabel) ?? "";
      return `<path d="M ${sx} ${sy} C ${sx} ${middle}, ${tx} ${middle}, ${tx} ${ty}" stroke="${color}" fill="none" marker-end="url(#arrow)"/><text x="${(sx + tx) / 2 + 8}" y="${middle}" fill="${light ? "#111827" : "#f1f5f9"}" font-family="sans-serif" font-size="12">${escape(label.slice(0, 50))}</text>`;
    })
    .join("");
  const nodes = graph.nodes
    .map((n) => {
      const p = positions.get(n.id) ?? { x: 0, y: 0 };
      const label = business ? n.businessTitle : n.technicalTitle;
      const pieces = label.match(/.{1,31}/gu)?.slice(0, 3) ?? [""];
      return `<g transform="translate(${p.x + 20},${p.y + 20})"><rect width="${nodeSize.width}" height="${nodeSize.height}" rx="10" fill="${light ? "#ffffff" : "#111827"}" stroke="${colors[n.kind]}" stroke-width="2"/><text x="12" y="22" fill="${light ? "#111827" : "#f1f5f9"}" font-size="11" font-family="sans-serif">${n.kind}</text>${pieces.map((line, i) => `<text x="12" y="${45 + i * 18}" fill="${light ? "#111827" : "#f1f5f9"}" font-size="13" font-family="sans-serif">${escape(line)}</text>`).join("")}${n.kind === "SCREEN" ? `<text x="12" y="125" fill="${light ? "#1e40af" : "#bfdbfe"}" font-family="sans-serif" font-size="12">${escape(n.routeInfo?.routePath || "Chưa xác định route")}</text>` : ""}</g>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="${light ? "#475569" : "#94a3b8"}"/></marker></defs><rect width="100%" height="100%" fill="${light ? "#F8FAFC" : "#0B0F17"}"/>${lines}${nodes}</svg>`;
  if (format === "svg")
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (width * height > 16000000)
    throw Error("Image too large; choose SVG or a smaller feature.");
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const context = canvas.getContext("2d");
  if (!context) throw Error("Canvas unavailable");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
