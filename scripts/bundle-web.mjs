import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dest = fileURLToPath(new URL("../lib/src/web_assets/", import.meta.url));
await mkdir(dest, { recursive: true });
for (const name of await readdir(dest))
  await rm(`${dest}/${name}`, { recursive: true, force: true });
await cp(fileURLToPath(new URL("../web_studio/dist/", import.meta.url)), dest, {
  recursive: true,
});

// Retain the licenses of distributed dependencies, including the ELK worker.
const { readFile, writeFile } = await import("node:fs/promises");
const studioDir = fileURLToPath(new URL("../web_studio/", import.meta.url));
const lock = JSON.parse(
  await readFile(`${studioDir}/package-lock.json`, "utf8"),
);
let notices =
  "Bundled third-party dependencies retain their own licenses.\nELKjs source: https://github.com/kieler/elkjs (upstream engine: https://github.com/eclipse-elk/elk).\n\n";
for (const [relative, entry] of Object.entries(lock.packages)) {
  if (
    !relative.startsWith("node_modules/") ||
    relative.split("/").includes("..") ||
    entry.dev
  )
    continue;
  const directory = `${studioDir}/${relative}`;
  let metadata;
  try {
    metadata = JSON.parse(await readFile(`${directory}/package.json`, "utf8"));
  } catch {
    continue;
  }
  notices += `\n${"=".repeat(72)}\n${metadata.name} ${metadata.version} — ${metadata.license ?? "see upstream package"}\n`;
  for (const name of (await readdir(directory)).sort()) {
    if (!/^(licen[cs]e|copying|notice)(\.[a-z0-9]+)?$/i.test(name)) continue;
    try {
      notices += `\n${name}\n${await readFile(`${directory}/${name}`, "utf8")}\n`;
    } catch {}
  }
}
await writeFile(`${dest}/THIRD_PARTY_NOTICES.txt`, notices);
