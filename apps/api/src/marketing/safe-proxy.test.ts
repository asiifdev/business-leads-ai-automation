import { test } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import * as net from "node:net";
import { resolvePublic, SafeProxy } from "./safe-proxy";

async function viaProxy(proxyPort: number, absoluteUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: proxyPort, path: absoluteUrl, headers: { host: new URL(absoluteUrl).host } }, (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", reject);
    req.end();
  });
}

function connectVia(proxyPort: number, target: string): Promise<string> {
  return new Promise((resolve) => {
    const s = net.connect(proxyPort, "127.0.0.1", () => s.write(`CONNECT ${target} HTTP/1.1\r\nHost: ${target}\r\n\r\n`));
    let buf = "";
    s.on("data", (d) => { buf += d.toString(); if (buf.includes("\r\n")) { s.destroy(); resolve(buf.split("\r\n")[0]); } });
    s.on("close", () => resolve(buf.split("\r\n")[0] || "closed"));
    s.on("error", () => resolve("error"));
  });
}

test("resolvePublic refuses private literals and local names", async () => {
  for (const h of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "::1", "localhost", "printer.local", "db.internal"]) assert.equal(await resolvePublic(h), null, h);
  assert.equal(await resolvePublic("8.8.8.8"), "8.8.8.8");
});

test("the proxy refuses to reach a local server (HTTP) and private tunnels (CONNECT), and odd ports", async () => {
  let hit = 0;
  const local = http.createServer((_q, r) => { hit++; r.end("secret"); });
  await new Promise<void>((r) => local.listen(0, "127.0.0.1", r));
  const proxy = new SafeProxy();
  const port = await proxy.start();
  try {
    assert.equal(await viaProxy(port, `http://127.0.0.1:${(local.address() as net.AddressInfo).port}/`), 403);
    assert.equal(await viaProxy(port, "http://169.254.169.254/latest/meta-data"), 403);
    assert.match(await connectVia(port, "127.0.0.1:443"), /403/);
    assert.match(await connectVia(port, "10.0.0.5:443"), /403/);
    assert.match(await connectVia(port, "example.com:22"), /403/);
    assert.equal(hit, 0, "the local server must never be reached");
  } finally {
    await proxy.close();
    local.close();
  }
});
