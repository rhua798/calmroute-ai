import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function callWorker(path, init = {}, env = {}) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-api`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, init), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...env }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the CalmRoute AI product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*安心领航[^<]*<\/title>/i);
  assert.match(html, /让每一次出发/);
  assert.match(html, /AI 主动式出行助手/);
  assert.match(html, /可交互 Agent Demo/);
  assert.match(html, /生成安心行程/);
  assert.match(html, /出发地/);
  assert.match(html, /当前电量/);
  assert.match(html, /上海虹桥火车站/);
  assert.match(html, /莫干山风景名胜区/);
  assert.match(html, /路线版本 R(?:<!-- -->)?1/);
  assert.match(html, /在途中注入异常/);
  assert.match(html, /充电排队/);
  assert.match(html, /错过出口/);
  assert.match(html, /道路异常/);
  assert.match(html, /停车困难/);
  assert.match(html, /为什么推荐/);
  assert.match(html, /真实算路链路成功率/);
  assert.match(html, /2026-09-01 两轮自动化路线矩阵/);
  assert.match(html, /上海/);
  assert.match(html, /莫干山/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("route API keeps the map key server-side", async () => {
  const response = await callWorker("/api/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin: "上海虹桥火车站", destination: "莫干山风景名胜区" }) });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "AMAP_KEY_NOT_CONFIGURED" });
});

test("route API rejects malformed JSON before calling the map service", async () => {
  const response = await callWorker(
    "/api/route",
    { method: "POST", headers: { "content-type": "application/json" }, body: "{" },
    { AMAP_WEB_SERVICE_KEY: "test-only" },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "INVALID_JSON" });
});

test("route API coalesces identical requests while a route is in flight", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-coalesce`);
  const { default: worker } = await import(workerUrl.href);
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;

  globalThis.fetch = async (input) => {
    upstreamCalls += 1;
    const url = new URL(String(input));
    if (url.pathname.includes("/geocode/geo")) {
      const address = url.searchParams.get("address") ?? "";
      const isOrigin = address.includes("上海");
      return Response.json({ status: "1", info: "OK", geocodes: [{ formatted_address: address, location: isOrigin ? "121.30,31.20" : "120.00,30.50", city: isOrigin ? "上海市" : "湖州市", district: "测试区" }] });
    }
    if (url.pathname.includes("/direction/driving")) {
      return Response.json({ status: "1", info: "OK", route: { paths: [{ distance: "200000", duration: "9000", tolls: "80", steps: [{ distance: "200000", polyline: "121.30,31.20;120.00,30.50" }] }] } });
    }
    return Response.json({ status: "1", info: "OK", pois: [] });
  };

  try {
    const env = { AMAP_WEB_SERVICE_KEY: "test-only", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
    const ctx = { waitUntil() {}, passThroughOnException() {} };
    const body = JSON.stringify({ origin: "上海虹桥火车站", destination: "莫干山风景名胜区" });
    const request = () => worker.fetch(new Request("http://localhost/api/route", { method: "POST", headers: { "content-type": "application/json" }, body }), env, ctx);
    const responses = await Promise.all([request(), request()]);
    assert.deepEqual(responses.map(response => response.status), [200, 200]);
    assert.equal(upstreamCalls, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("server-renders the case study with route-specific metadata", async () => {
  const response = await render("/case-study");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>[^<]*产品案例研究[^<]*<\/title>/i);
  assert.match(html, /从“路线导航”/);
  assert.match(html, /待验证产品假设/);
  assert.match(html, /Agent 任务编排/);
  assert.match(html, /工程验证/);
  assert.match(html, /地图引擎错误/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
