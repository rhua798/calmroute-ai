const baseUrl = (process.argv[2] || process.env.ROUTE_API_URL || "http://localhost:3000").replace(/\/$/, "");

const scenarios = [
  ["上海市闵行区上海虹桥火车站", "湖州市德清县莫干山风景名胜区"],
  ["杭州市上城区杭州市民中心", "湖州市安吉县安吉竹博园"],
  ["苏州市工业园区苏州中心", "湖州市吴兴区湖州博物馆"],
  ["上海市黄浦区人民广场", "上海市浦东新区滴水湖"],
  ["杭州市上城区杭州东站", "杭州市淳安县千岛湖风景区"],
  ["南京市雨花台区南京南站", "南京市高淳区高淳老街"],
  ["宁波市海曙区宁波站", "宁波市象山县象山影视城"],
  ["无锡市锡山区无锡东站", "无锡市滨湖区灵山大佛"],
  ["嘉兴市南湖区嘉兴南站", "嘉兴市桐乡市乌镇西栅景区"],
  ["湖州市吴兴区湖州站", "湖州市德清县莫干山风景名胜区"],
];

async function postRoute(payload) {
  let latest;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const startedAt = performance.now();
    const response = await fetch(`${baseUrl}/api/route`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });
    const data = await response.json().catch(() => ({}));
    latest = { response, data, latencyMs: Math.round(performance.now() - startedAt), attempts: attempt };
    if (response.ok || !/LIMIT|timeout|UNAVAILABLE/i.test(String(data.error || ""))) return latest;
    await new Promise(resolve => setTimeout(resolve, attempt * 2500));
  }
  return latest;
}

async function validateScenario([origin, destination], index) {
  try {
    const base = await postRoute({ origin, destination });
    const charging = base.data.chargingCandidates ?? [];
    const parking = base.data.parkingCandidates ?? [];
    const waypoint = charging[1]?.location || charging[0]?.location || parking[0]?.location;
    let reroute = null;
    if (base.response.ok && waypoint) reroute = await postRoute({ origin, destination, waypoint });

    const basePath = base.data.paths?.[0];
    const reroutePath = reroute?.data?.paths?.[0];
    return {
      id: index + 1,
      origin,
      destination,
      routeOk: base.response.ok && Boolean(basePath),
      chargingPoiOk: charging.length > 0,
      parkingPoiOk: parking.length > 0,
      rerouteOk: Boolean(reroute?.response.ok && reroutePath),
      baseDistanceKm: basePath ? Math.round(basePath.distanceMeters / 100) / 10 : null,
      rerouteDistanceKm: reroutePath ? Math.round(reroutePath.distanceMeters / 100) / 10 : null,
      baseDurationMin: basePath ? Math.round(basePath.durationSeconds / 60) : null,
      rerouteDurationMin: reroutePath ? Math.round(reroutePath.durationSeconds / 60) : null,
      chargingPoiCount: charging.length,
      parkingPoiCount: parking.length,
      baseLatencyMs: base.latencyMs,
      rerouteLatencyMs: reroute?.latencyMs ?? null,
      baseAttempts: base.attempts,
      rerouteAttempts: reroute?.attempts ?? null,
      error: base.data.error || reroute?.data?.error || null,
    };
  } catch (error) {
    return { id: index + 1, origin, destination, routeOk: false, chargingPoiOk: false, parkingPoiOk: false, rerouteOk: false, error: error instanceof Error ? error.message : "UNKNOWN_ERROR" };
  }
}

const results = [];
for (let index = 0; index < scenarios.length; index += 1) {
  results.push(await validateScenario(scenarios[index], index));
  await new Promise(resolve => setTimeout(resolve, 1200));
}

const count = results.length;
const rate = key => Math.round(results.filter(result => result[key]).length / count * 1000) / 10;
const latencies = results.flatMap(result => [result.baseLatencyMs, result.rerouteLatencyMs]).filter(Number.isFinite);
const summary = {
  scenarioCount: count,
  routeSuccessRate: rate("routeOk"),
  chargingPoiReturnRate: rate("chargingPoiOk"),
  parkingPoiReturnRate: rate("parkingPoiOk"),
  rerouteSuccessRate: rate("rerouteOk"),
  medianApiLatencyMs: latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)] ?? null,
  retriedRequestCount: results.filter(result => (result.baseAttempts || 1) > 1 || (result.rerouteAttempts || 1) > 1).length,
};

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  baseUrl,
  methodology: "10 条带城市/区县的公开地点路线，按顺序执行并对限流/超时最多退避重试 2 次；每条先真实算路并搜索充电/停车 POI，再选取返回的备选 POI 作为途经点重新算路。指标仅代表本轮接口测试，不代表用户体验实验或实时车位/充电状态。",
  summary,
  results,
}, null, 2));

if (summary.routeSuccessRate < 100 || summary.rerouteSuccessRate < 100) process.exitCode = 1;
