import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFile, mkdir, readFile } from "node:fs/promises";
async function check(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).analyze();
  await mkdir("../docs/progress/logs", { recursive: true });
  await writeFile(
    `../docs/progress/logs/axe-${name}.json`,
    JSON.stringify(
      {
        url: results.url,
        timestamp: results.timestamp,
        testEngine: results.testEngine,
        violations: results.violations,
        passes: results.passes.map((p) => p.id),
      },
      null,
      2,
    ),
  );
  expect(
    results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/?demo=1");
  await expect(page.locator(".flow-node").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Bản đồ luồng" }),
  ).toHaveAttribute("aria-busy", "false");
});
function loginNode(page: Page) {
  return page
    .locator(".react-flow__node")
    .filter({ has: page.locator("strong", { hasText: /^LoginScreen$/ }) });
}
test("readable overview, screen-only view and neighborhood preserve access to all nodes", async ({
  page,
}) => {
  await expect
    .poll(() =>
      page
        .locator(".react-flow__viewport")
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
    )
    .toBeGreaterThanOrEqual(0.65);
  const overview = await page.locator(".flow-node").count();
  await page.getByLabel("Chi tiết đồ thị", { exact: true }).selectOption("all");
  await expect
    .poll(() => page.locator(".flow-node").count())
    .toBeGreaterThan(overview);
  await page
    .getByLabel("Chi tiết đồ thị", { exact: true })
    .selectOption("screens");
  await expect(page.locator(".flow-node")).toHaveCount(2);
  await loginNode(page).click();
  const inspector = page.getByRole("complementary", { name: "Chi tiết node" });
  await expect(
    inspector.getByRole("region", { name: "Router màn hình" }),
  ).toContainText("/");
  await expect(
    inspector
      .getByRole("region", { name: "Liên kết đi" })
      .getByRole("button")
      .first(),
  ).toBeVisible();
  await inspector.getByRole("button", { name: "Xem liên kết gần" }).click();
  await expect(page.getByLabel("Phạm vi đồ thị", { exact: true })).toHaveValue(
    "nearby",
  );
  await expect(loginNode(page)).toBeVisible();
});
test("nodes resize with keyboard and pointer, drag freely, and connectors have arrowheads", async ({
  page,
}) => {
  const node = loginNode(page);
  await node.click();
  await page.getByLabel("Chiều rộng node", { exact: true }).fill("420");
  await expect(node).toHaveCSS("width", "420px");
  await page.getByRole("button", { name: "Đọc rõ", exact: true }).click();
  await expect
    .poll(async () => {
      const n = await node.boundingBox(),
        c = await page
          .getByRole("region", { name: "Bản đồ luồng" })
          .boundingBox();
      return n && c ? Math.abs(n.x + n.width / 2 - c.x - c.width / 2) : 999;
    })
    .toBeLessThan(3);
  const handle = node.locator(
    ".react-flow__resize-control.handle.bottom.right",
  );
  const corner = await handle.boundingBox();
  if (!corner) throw Error("Resize handle missing");
  await page.mouse.move(
    corner.x + corner.width / 2,
    corner.y + corner.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    corner.x + corner.width / 2 + 90,
    corner.y + corner.height / 2 + 60,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(() => node.evaluate((el) => parseFloat(getComputedStyle(el).width)))
    .toBeGreaterThan(470);
  const start = await node.boundingBox(),
    header = await node.locator(".node-kind").boundingBox();
  if (!start || !header) throw Error("Node missing");
  await page.mouse.move(
    header.x + header.width / 2,
    header.y + header.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    header.x + header.width / 2 + 60,
    header.y + header.height / 2 + 40,
    { steps: 10 },
  );
  await page.mouse.up();
  await expect
    .poll(async () => Math.abs((await node.boundingBox())!.x - start.x))
    .toBeGreaterThan(40);
  await page
    .getByLabel("Kiểu đường nối", { exact: true })
    .selectOption("curve");
  await expect
    .poll(() =>
      page.locator(".react-flow__edge-path").first().getAttribute("d"),
    )
    .toContain("C");
  await expect(
    page.locator(".react-flow__edge-path[marker-end]").first(),
  ).toBeAttached();
  await page
    .getByLabel("Kiểu đường nối", { exact: true })
    .selectOption("straight");
  await expect
    .poll(() =>
      page.locator(".react-flow__edge-path").first().getAttribute("d"),
    )
    .not.toContain("C");
});
test("inspector shows the complete function and a full-size source viewer without an IDE", async ({
  page,
}) => {
  const fixture = JSON.parse(await readFile("public/demo.flow.json", "utf8"));
  const api = fixture.nodes.find((n: { kind: string }) => n.kind === "API");
  const code = fixture.sourceContexts[api.sourceLocation.contextId].code;
  await page.getByRole("textbox", { name: "Tìm node" }).fill("dio.post");
  await page.getByRole("textbox", { name: "Tìm node" }).press("Enter");
  const inspector = page.getByRole("complementary", { name: "Chi tiết node" });
  await expect(
    inspector.getByLabel("Mã nguồn function đầy đủ", { exact: true }),
  ).toHaveText(code);
  await inspector
    .getByRole("button", { name: "Mở rộng mã", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: /Mã đầy đủ/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("textbox", { name: "Mã nguồn có thể chọn và sao chép" }),
  ).toHaveValue(code);
  await check(page, "source");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(inspector).toBeVisible();
  await expect(page.locator(".legend").first()).toContainText("BOTTOMSHEET");
  await expect(page.locator(".legend").first()).not.toContainText("LOGOUT");
});
test("graph, search, modes, inspector keyboard and export modal", async ({
  page,
}) => {
  await check(page, "canvas");
  await page.getByRole("button", { name: "Theo bước", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Theo bước", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Tiêu điểm", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tiêu điểm", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "Tìm node" }).fill("login");
  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  await page
    .locator(".flow-node")
    .filter({ has: page.locator("strong", { hasText: /^LoginScreen$/ }) })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Chi tiết node" }),
  ).toBeVisible();
  await check(page, "inspector");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("complementary", { name: "Chi tiết node" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Kiểm thử", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Độ phủ nhánh" }),
  ).toBeVisible();
  await check(page, "tester");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await check(page, "export");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.keyboard.press("Alt+4");
  await expect(
    page.getByRole("button", { name: "Low-Code", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("snapshot download and import retain graph", async ({ page }) => {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải file" }).click();
  const downloaded = await pending;
  expect(downloaded.suggestedFilename()).toBe("flow.flow.json");
  await page
    .locator("input[type=file]")
    .setInputFiles((await downloaded.path())!);
  await expect(page.locator(".statusbar").getByRole("status")).toContainText(
    "Snapshot",
  );
  await expect(page.locator(".flow-node").first()).toBeVisible();
});
test("invalid snapshot reports recovery action", async ({ page }) => {
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.flow.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"graph":null}'),
  });
  await expect(page.getByRole("alert")).toContainText("Snapshot không hợp lệ");
});

test("exports valid editable graph files and 2x PNG/SVG images", async ({
  page,
}) => {
  const { readFile } = await import("node:fs/promises");
  for (const format of ["drawio", "excalidraw", "mmd", "puml", "svg", "png"]) {
    await page.getByRole("button", { name: "Export", exact: true }).click();
    await page.getByLabel("Định dạng", { exact: true }).selectOption(format);
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Tải file" }).click();
    const file = await pending;
    const data = await readFile((await file.path())!);
    if (format === "png") {
      expect(data.subarray(1, 4).toString()).toBe("PNG");
      expect(data.readUInt32BE(16)).toBeGreaterThan(1000);
    } else if (format === "excalidraw") {
      const json = JSON.parse(data.toString());
      expect(json.type).toBe("excalidraw");
      expect(
        json.elements.some((e: { type: string }) => e.type === "arrow"),
      ).toBe(true);
    } else if (format === "svg" || format === "drawio") {
      const parsed = await page.evaluate((text) => {
        const doc = new DOMParser().parseFromString(text, "application/xml");
        return {
          errors: doc.querySelectorAll("parsererror").length,
          root: doc.documentElement.tagName,
        };
      }, data.toString());
      expect(parsed.errors).toBe(0);
      expect(parsed.root).toBe(format === "svg" ? "svg" : "mxfile");
    } else
      expect(data.toString()).toContain(
        format === "mmd" ? "flowchart LR" : "@startuml",
      );
  }
});
