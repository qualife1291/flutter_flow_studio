import { it, expect } from "vitest";
import { ideLink } from "./ideLink";
it("opens an absolute source location and preserves spaces and Windows drives", () => {
  expect(ideLink("vscode", "lib/login.dart", 42, "/Users/dev/My App")).toBe(
    "vscode://file/Users/dev/My%20App/lib/login.dart:42",
  );
  expect(ideLink("cursor", "lib\\login.dart", 8, "C:\\My App")).toBe(
    "cursor://file/C:/My%20App/lib/login.dart:8",
  );
});
