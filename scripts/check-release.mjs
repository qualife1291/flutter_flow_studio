import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
const require = createRequire(
  new URL("../web_studio/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const root = resolve("example/build/release_check");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".json": "application/json",
  ".ttf": "font/ttf",
};
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    const file = (await stat(path)).isDirectory()
      ? resolve(path, "index.html")
      : path;
    res.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  const sockets = [];
  const errors = [];
  page.on("websocket", (ws) => sockets.push(ws.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  const sentinel = page.waitForEvent("console", {
    predicate: (msg) =>
      msg.text().includes("FLOW_STUDIO_RELEASE_NO_SOCKET_PASS"),
    timeout: 45000,
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await sentinel;
  await page.waitForTimeout(300);
  if (sockets.length || errors.length)
    throw Error(
      `Release check failed: sockets=${sockets.length}, errors=${errors.join(";")}`,
    );
  console.log(
    "PASS: real Flutter release build called init and FlowProbe with no WebSocket creation.",
  );
} finally {
  await browser?.close();
  server.close();
}
