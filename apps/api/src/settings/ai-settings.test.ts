import test from "node:test";
import assert from "node:assert/strict";
import { friendlyAiError, mergeAiConfig } from "./ai-settings";
import { pickAiSettings, assertAllowedBaseUrl } from "../ai/ai-client.service";

const server = { apiKey: "sk-server", baseURL: "http://localhost:11434/v1", chatModel: "gemma3", embeddingModel: "nomic-embed-text" };

test("a workspace key wins and never inherits the server's endpoint or model names", () => {
  const s = pickAiSettings({ apiKey: "sk-ws" }, true, server);
  assert.equal(s.source, "workspace");
  assert.equal(s.apiKey, "sk-ws");
  assert.equal(s.baseURL, undefined);
  assert.equal(s.chatModel, "gpt-4o-mini");
  assert.equal(s.embeddingModel, "text-embedding-3-small");
});

test("a workspace key keeps its own base URL and models", () => {
  const s = pickAiSettings({ apiKey: "k", baseURL: "https://openrouter.ai/api/v1", model: "x/y", embeddingModel: "emb" }, true, server);
  assert.deepEqual([s.baseURL, s.chatModel, s.embeddingModel], ["https://openrouter.ai/api/v1", "x/y", "emb"]);
});

test("without a workspace key the server key applies, with neither AI is off", () => {
  assert.equal(pickAiSettings(null, false, server).source, "server");
  assert.equal(pickAiSettings({ apiKey: "k" }, false, server).source, "server");
  assert.equal(pickAiSettings({ model: "m" }, true, server).source, "server");
  assert.equal(pickAiSettings(null, false, { chatModel: "a", embeddingModel: "b" }).source, "none");
});

test("blank key keeps the saved key, blank fields clear", () => {
  const saved = { apiKey: "enc", model: "m1", baseURL: "https://a" };
  assert.deepEqual(mergeAiConfig(saved, { apiKey: "", model: "m2", baseURL: "" }), { apiKey: "enc", model: "m2" });
  assert.equal(mergeAiConfig(saved, { apiKey: " new " }).apiKey, "new");
  assert.deepEqual(mergeAiConfig(null, {}), {});
});

test("provider errors never echo the provider's own message", () => {
  const msg = friendlyAiError({ status: 401, message: "Incorrect API key provided: sk-abc***xyz" });
  assert.ok(!msg.includes("sk-"));
  assert.match(friendlyAiError({ code: "ECONNREFUSED" }), /refused/);
});

test("base URL rules: private only for self-hosted, https and public on a shared server", async () => {
  await assert.doesNotReject(assertAllowedBaseUrl("http://localhost:11434/v1", { allowPrivate: true }));
  await assert.rejects(assertAllowedBaseUrl("http://localhost:11434/v1", { allowPrivate: false }));
  await assert.rejects(assertAllowedBaseUrl("https://127.0.0.1/v1", { allowPrivate: false }));
  await assert.rejects(assertAllowedBaseUrl("https://169.254.169.254/latest", { allowPrivate: false }));
  await assert.rejects(assertAllowedBaseUrl("ftp://example.com", { allowPrivate: true }));
  await assert.rejects(assertAllowedBaseUrl("https://user:pw@example.com", { allowPrivate: true }));
  await assert.rejects(assertAllowedBaseUrl("not a url", { allowPrivate: true }));
});

test("connect-time lookup refuses private answers and passes public ones", async () => {
  const { publicOnlyLookup } = await import("../ai/ai-client.service");
  const run = (host: string) =>
    new Promise<{ err: NodeJS.ErrnoException | null; address: unknown }>((resolve) =>
      publicOnlyLookup(host, {}, (err, address) => resolve({ err, address })),
    );
  const loop = await run("localhost");
  assert.equal(loop.err?.code, "EBLOCKED");
  const literal = await run("127.0.0.1");
  assert.equal(literal.err?.code, "EBLOCKED");
  const meta = await run("169.254.169.254");
  assert.equal(meta.err?.code, "EBLOCKED");
});
