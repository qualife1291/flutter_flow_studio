import { useRef, useState, type RefObject } from "react";
import { X, Maximize, Copy, ScanSearch } from "lucide-react";
import type {
  FlowGraphPayload,
  FlowNodeData,
  RoleViewMode,
} from "../types/graph";
import { ideLink } from "../engine/ideLink";
import { edgeKind, edgeLabels } from "../engine/graphView";
export function NodeInspector({
  node,
  graph,
  mode,
  onSelect,
  onFocus,
  onNeighbors,
  closeRef,
}: {
  node: FlowNodeData;
  graph: FlowGraphPayload;
  mode: RoleViewMode;
  onSelect: (id: string | null) => void;
  onFocus: () => void;
  onNeighbors: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
}) {
  const source = node.sourceLocation,
    context = source?.contextId
      ? graph.sourceContexts?.[source.contextId]
      : undefined;
  const code = context?.code ?? source?.codeSnippet ?? "";
  const dialog = useRef<HTMLDialogElement>(null);
  const [wrap, setWrap] = useState(false),
    [message, setMessage] = useState("");
  const routes = [
    ...new Set(
      [node.routeInfo?.routePath, ...(node.routeInfo?.aliases ?? [])].filter(
        (v): v is string => !!v,
      ),
    ),
  ];
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Đã sao chép mã nguồn.");
    } catch {
      setMessage(
        "Trình duyệt không cho sao chép tự động. Chọn mã và dùng Ctrl/Cmd+C.",
      );
    }
  }
  const codeView = (
    <pre
      tabIndex={0}
      className={wrap ? "code-wrap" : ""}
      aria-label={context ? "Mã nguồn function đầy đủ" : "Trích đoạn mã nguồn"}
    >
      <code>{code}</code>
    </pre>
  );
  return (
    <aside className="inspector" aria-label="Chi tiết node">
      <button
        ref={closeRef}
        className="close"
        aria-label="Đóng chi tiết"
        onClick={() => onSelect(null)}
      >
        <X />
      </button>
      <p className="eyebrow">NODE INSPECTOR</p>
      <h2>{mode === "DEV" ? node.technicalTitle : node.businessTitle}</h2>
      <p>
        {node.kind} · {node.featureGroup}
      </p>
      <div className="inspector-actions">
        <button onClick={onFocus}>
          <Maximize size={16} />
          Tập trung node
        </button>
        <button onClick={onNeighbors}>
          <ScanSearch size={16} />
          Xem liên kết gần
        </button>
      </div>
      {node.kind === "SCREEN" && (
        <section aria-label="Router màn hình">
          <h3>Router</h3>
          <p>
            {node.routeInfo?.router ?? "Chưa xác định"}
            {node.routeInfo?.isInitialRoute ? " · Màn hình khởi đầu" : ""}
          </p>
          {routes.length ? (
            <ul className="route-list">
              {routes.map((route) => (
                <li key={route}>
                  <code>{route}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Chưa xác định route tĩnh. Đặt tên trong router hoặc RouteSettings
              để hiển thị tại đây.
            </p>
          )}
        </section>
      )}
      {source && (
        <section aria-label="Mã nguồn">
          <h3>
            {context ? `Function / class: ${context.name}` : "Trích đoạn"}
          </h3>
          <p>
            {source.filePath}:{context?.startLine ?? source.line}
            {context ? `–${context.endLine}` : ""}
          </p>
          {!context && (
            <p>
              Snapshot này chỉ có trích đoạn. Quét lại bằng CLI mới để xem đầy
              đủ function.
            </p>
          )}
          <div className="code-actions">
            <button onClick={() => dialog.current?.showModal()}>
              <Maximize size={16} />
              Mở rộng mã
            </button>
            <button onClick={() => void copyCode()}>
              <Copy size={16} />
              Sao chép
            </button>
            <label>
              <input
                type="checkbox"
                checked={wrap}
                onChange={(e) => setWrap(e.target.checked)}
              />
              Ngắt dòng
            </label>
          </div>
          {message && <p role="status">{message}</p>}
          {codeView}
          <details>
            <summary>Mở IDE (tùy chọn)</summary>
            {(["vscode", "cursor"] as const).map((ide) => (
              <a
                key={ide}
                className="button"
                href={ideLink(
                  ide,
                  source.filePath,
                  source.line,
                  graph.project.projectRoot,
                )}
              >
                Open in {ide === "vscode" ? "VS Code" : "Cursor"}
              </a>
            ))}
          </details>
        </section>
      )}
      {(["incoming", "outgoing"] as const).map((direction) => {
        const edges = graph.edges.filter((e) =>
          direction === "incoming"
            ? e.target === node.id
            : e.source === node.id,
        );
        return (
          <section
            key={direction}
            aria-label={
              direction === "incoming" ? "Liên kết đến" : "Liên kết đi"
            }
          >
            <h3>
              {direction === "incoming" ? "Đi từ" : "Đi tới"} · {edges.length}
            </h3>
            <ul className="node-links">
              {edges.map((e) => {
                const target = graph.nodes.find(
                  (n) =>
                    n.id === (direction === "incoming" ? e.source : e.target),
                );
                return (
                  target && (
                    <li key={e.id}>
                      <button onClick={() => onSelect(target.id)}>
                        <span>
                          {mode === "DEV"
                            ? target.technicalTitle
                            : target.businessTitle}
                        </span>
                        <small>
                          {(mode === "DEV"
                            ? e.technicalLabel
                            : e.businessLabel) ?? edgeLabels[edgeKind(e)]}
                        </small>
                      </button>
                    </li>
                  )
                );
              })}
            </ul>
            {!edges.length && <p>Chưa có liên kết tĩnh được xác định.</p>}
          </section>
        );
      })}
      {node.apiInfo && (
        <details>
          <summary>Thông tin API</summary>
          <pre>{JSON.stringify(node.apiInfo, null, 2)}</pre>
        </details>
      )}
      <h3>ID dùng với FlowProbe</h3>
      <code className="node-id">{node.id}</code>
      <dialog
        ref={dialog}
        className="code-dialog"
        aria-labelledby="full-code-title"
      >
        <div className="modal-header">
          <h2 id="full-code-title">
            {context ? `Mã đầy đủ · ${context.name}` : "Trích đoạn mã nguồn"}
          </h2>
          <button
            aria-label="Đóng mã nguồn"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </button>
        </div>
        <p>
          {source?.filePath}
          {context ? `:${context.startLine}–${context.endLine}` : ""}
        </p>
        <textarea
          aria-label="Mã nguồn có thể chọn và sao chép"
          spellCheck={false}
          readOnly
          value={code}
        />
        <p>Ctrl/Cmd+A trong vùng mã để chọn toàn bộ · Escape để đóng</p>
      </dialog>
    </aside>
  );
}
