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

test("server-renders the CalmRoute AI product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>[^<]*安心领航[^<]*<\/title>/i);
  assert.match(html, /让每一次出发/);
  assert.match(html, /AI 主动式出行助手/);
  assert.match(html, /上海/);
  assert.match(html, /莫干山/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("server-renders the case study with route-specific metadata", async () => {
  const response = await render("/case-study");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /<title>[^<]*产品案例研究[^<]*<\/title>/i);
  assert.match(html, /从“路线导航”/);
  assert.match(html, /待验证产品假设/);
  assert.match(html, /Agent 任务编排/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
