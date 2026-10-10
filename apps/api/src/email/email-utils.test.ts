import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFooter, headerLine, isPermanentSmtpError, signUnsubscribe, verifyUnsubscribe } from "./email-utils";

test("unsubscribe token round-trips and lowercases the address", () => {
  const t = signUnsubscribe("ws1", "Halo@Toko.ID", "secret-secret-1234");
  assert.deepEqual(verifyUnsubscribe(t, "secret-secret-1234"), { workspaceId: "ws1", email: "halo@toko.id" });
});

test("unsubscribe token rejects tampering, another secret and junk", () => {
  const t = signUnsubscribe("ws1", "a@b.id", "secret-secret-1234");
  const [p, m] = t.split(".");
  const forged = Buffer.from("ws2|a@b.id").toString("base64url") + "." + m;
  assert.equal(verifyUnsubscribe(forged, "secret-secret-1234"), null);
  assert.equal(verifyUnsubscribe(t, "another-secret-9999"), null);
  assert.equal(verifyUnsubscribe(p, "secret-secret-1234"), null);
  assert.equal(verifyUnsubscribe(`${t}.x`, "secret-secret-1234"), null);
  assert.equal(verifyUnsubscribe("x".repeat(1000), "secret-secret-1234"), null);
  assert.equal(verifyUnsubscribe("", "secret-secret-1234"), null);
});

test("headerLine removes line breaks so a subject cannot inject headers", () => {
  assert.equal(headerLine("Halo\r\nBcc: x@y.z"), "Halo Bcc: x@y.z");
  assert.equal(headerLine("a".repeat(500)).length, 200);
});

test("footer carries the sender, the address and the unsubscribe link", () => {
  const f = buildFooter({ language: "indonesian", url: "https://x.id/u/abc", fromName: "Asiifdev", postalAddress: "Jl. Contoh 1, Boyolali" });
  assert.match(f, /Asiifdev/);
  assert.match(f, /Jl\. Contoh 1, Boyolali/);
  assert.match(f, /https:\/\/x\.id\/u\/abc/);
  assert.match(buildFooter({ language: "english", url: "u", fromName: "A", postalAddress: "B" }), /Don't want emails/);
});

test("only 5xx SMTP replies are permanent", () => {
  assert.equal(isPermanentSmtpError({ responseCode: 550 }), true);
  assert.equal(isPermanentSmtpError({ responseCode: 451 }), false);
  assert.equal(isPermanentSmtpError(new Error("ETIMEDOUT")), false);
});
