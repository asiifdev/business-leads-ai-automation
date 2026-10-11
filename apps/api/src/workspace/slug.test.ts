import test from "node:test";
import assert from "node:assert/strict";
import { makeWorkspaceSlug } from "./slug";

test("slug is lowercase, hyphenated, ASCII and suffixed", () => {
  assert.equal(makeWorkspaceSlug("Griya Kamera Rental", 36, ""), "griya-kamera-rental-10");
  assert.equal(makeWorkspaceSlug("  Café  Bunga!!  ", 36, ""), "cafe-bunga-10");
});

test("a name with no usable characters still gets a slug", () => {
  assert.equal(makeWorkspaceSlug("!!!", 36, ""), "workspace-10");
  assert.equal(makeWorkspaceSlug("日本語", 36, ""), "workspace-10");
});

test("long names are cut", () => {
  assert.ok(makeWorkspaceSlug("a".repeat(200), 36).length <= 40 + 1 + 8 + 3);
});
