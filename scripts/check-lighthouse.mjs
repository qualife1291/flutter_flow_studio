import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
const require = createRequire(
  new URL("../web_studio/package.json", import.meta.url),
);
const { default: lighthouse } = await import(require.resolve("lighthouse"));
const chromeLauncher = await import(require.resolve("chrome-launcher"));
const preview = spawn("npm", ["run", "preview", "--", "--port", "4173"], {
  cwd: new URL("../web_studio", import.meta.url),
  stdio: "ignore",
});
let chrome;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch("http://127.0.0.1:4173")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw Error("Preview did not start");
  chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless", "--no-sandbox", "--disable-dev-shm-usage"],
  });
  const result = await lighthouse("http://127.0.0.1:4173/?demo=1", {
    port: chrome.port,
    onlyCategories: ["performance", "accessibility", "best-practices"],
    output: "json",
  });
  await mkdir(new URL("../docs/progress/logs/", import.meta.url), {
    recursive: true,
  });
  await writeFile(
    new URL("../docs/progress/logs/lighthouse.json", import.meta.url),
    JSON.stringify(result.lhr, null, 2),
  );
  for (const [key, min] of [
    ["performance", 80],
    ["accessibility", 95],
    ["best-practices", 95],
  ]) {
    const score = result.lhr.categories[key].score * 100;
    console.log(`${key}: ${score}`);
    if (score < min) process.exitCode = 1;
  }
} finally {
  await chrome?.kill();
  preview.kill();
}
