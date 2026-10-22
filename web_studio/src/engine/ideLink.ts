export function ideLink(
  editor: "vscode" | "cursor",
  filePath: string,
  line: number,
  projectRoot?: string,
): string {
  let path = filePath.replaceAll("\\", "/");
  if (!path.startsWith("/") && !/^[A-Za-z]:\//.test(path))
    path = `${projectRoot?.replaceAll("\\", "/").replace(/\/$/, "") ?? ""}/${path}`;
  const encoded = path
    .split("/")
    .map((segment) =>
      /^[A-Za-z]:$/.test(segment) ? segment : encodeURIComponent(segment),
    )
    .join("/");
  return `${editor}://file${encoded.startsWith("/") ? "" : "/"}${encoded}:${Math.max(1, Math.trunc(line))}`;
}
