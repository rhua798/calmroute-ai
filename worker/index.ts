/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AMAP_WEB_SERVICE_KEY?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const inFlightRoutes = new Map<string, Promise<Response>>();
let amapQueue: Promise<unknown> = Promise.resolve();
let lastAmapRequestAt = 0;

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/route") {
      return handleRouteRequest(request, env);
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

type AmapGeocodeResponse = {
  status: string;
  info: string;
  geocodes?: Array<{ formatted_address: string; location: string; city: string; district: string }>;
};

type AmapRouteStep = { instruction: string; road: string; distance: string; action: string; polyline?: string };

type AmapDirectionResponse = {
  status: string;
  info: string;
  route?: {
    paths?: Array<{
      distance: string;
      duration: string;
      strategy: string;
      tolls?: string;
      traffic_lights?: string;
      steps?: AmapRouteStep[];
    }>;
  };
};

type AmapPlaceResponse = {
  status: string;
  info: string;
  pois?: Array<{ id: string; name: string; location: string; address: string | string[]; type: string; typecode: string; distance?: string; business?: { parking_type?: string }; navi?: { entr_location?: string } }>;
};

type RoutePoi = { id: string; name: string; location: string; address: string; type: string; typecode: string; distanceMeters: number; parkingType: string };

async function handleRouteRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!env.AMAP_WEB_SERVICE_KEY) return json({ error: "AMAP_KEY_NOT_CONFIGURED" }, 503);

  let rawBody = "";
  let body: { origin?: unknown; destination?: unknown; waypoint?: unknown };
  try {
    rawBody = await request.text();
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }

  const requestKey = await hashRequest(rawBody);
  const existing = inFlightRoutes.get(requestKey);
  if (existing) return (await existing).clone();

  const task = executeRouteRequest(body, env.AMAP_WEB_SERVICE_KEY).finally(() => inFlightRoutes.delete(requestKey));
  inFlightRoutes.set(requestKey, task);
  return (await task).clone();
}

async function executeRouteRequest(body: { origin?: unknown; destination?: unknown; waypoint?: unknown }, key: string): Promise<Response> {
  try {
    const originName = normalizePlace(body.origin);
    const destinationName = normalizePlace(body.destination);
    const waypoint = normalizeCoordinate(body.waypoint);
    if (!originName || !destinationName) return json({ error: "INVALID_PLACE" }, 400);

    const [origin, destination] = await Promise.all([
      geocode(originName, key),
      geocode(destinationName, key),
    ]);
    let direction: AmapDirectionResponse;
    let recoveryParking: RoutePoi[] = [];
    let routeRecovery: { type: "destination_access_point"; accessPoint: RoutePoi } | null = null;
    try {
      direction = await drivingRoute(origin.location, destination.location, key, waypoint);
    } catch (error) {
      if (!(error instanceof Error) || !/ENGINE_RESPONSE_DATA_ERROR|ROUTE_NOT_FOUND/.test(error.message)) throw error;
      recoveryParking = await nearbySearch(destination.location, "停车场", 5000, key);
      const accessPoint = recoveryParking[0];
      if (!accessPoint) throw error;
      direction = await drivingRoute(origin.location, accessPoint.location, key, waypoint);
      routeRecovery = { type: "destination_access_point", accessPoint };
    }
    const paths = direction.route?.paths ?? [];
    if (!paths.length) return json({ error: "ROUTE_NOT_FOUND" }, 404);
    const routeCenter = routeMidpoint(paths[0]?.steps) || midpoint(origin.location, destination.location);
    const [charging, parking] = await Promise.all([
      nearbySearch(routeCenter, "充电站", 30000, key),
      recoveryParking.length ? Promise.resolve(recoveryParking) : nearbySearch(destination.location, "停车场", 5000, key),
    ]);

    return json({
      source: "amap",
      origin: { name: originName, ...origin },
      destination: { name: destinationName, ...destination },
      routeCenter,
      routeRecovery,
      chargingCandidates: charging,
      parkingCandidates: parking,
      paths: paths.slice(0, 3).map(path => ({
        distanceMeters: Number(path.distance),
        durationSeconds: Number(path.duration),
        strategy: path.strategy,
        tolls: Number(path.tolls || 0),
        trafficLights: Number(path.traffic_lights || 0),
        steps: (path.steps ?? []).slice(0, 8).map(step => ({ instruction: step.instruction, road: step.road, distanceMeters: Number(step.distance), action: step.action })),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "PLACE_NOT_FOUND" ? 404 : 502);
  }
}

async function hashRequest(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function normalizePlace(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/[<>]/g, "");
  return trimmed.length >= 2 && trimmed.length <= 80 ? trimmed : "";
}

function normalizeCoordinate(value: unknown) {
  if (typeof value !== "string" || !/^-?\d{1,3}(\.\d{1,6})?,-?\d{1,2}(\.\d{1,6})?$/.test(value)) return "";
  return value;
}

async function geocode(address: string, key: string) {
  const query = geocodeQuery(address);
  const params = new URLSearchParams({ key, address: query.keyword, output: "JSON" });
  if (query.city) {
    params.set("city", query.city);
    params.set("citylimit", "true");
  }
  const data = await fetchAmapJson<AmapGeocodeResponse>(`https://restapi.amap.com/v3/geocode/geo?${params}`, 12000);
  const result = data.geocodes?.[0];
  if (data.status !== "1" || !result?.location) throw new Error(data.info === "OK" ? "PLACE_NOT_FOUND" : `AMAP_${data.info || "GEOCODE_ERROR"}`);
  return { formattedAddress: result.formatted_address, location: result.location, city: String(result.city || ""), district: result.district };
}

function geocodeQuery(address: string) {
  const cityMatch = address.match(/^(.{2,8}?市)/);
  if (!cityMatch) return { city: "", keyword: address };
  const city = cityMatch[1];
  const withoutCity = address.slice(city.length);
  const keyword = withoutCity.replace(/^.{2,8}?(?:区|县|市)/, "") || withoutCity || address;
  return { city, keyword };
}

async function drivingRoute(origin: string, destination: string, key: string, waypoint = "") {
  const params = new URLSearchParams({ key, origin, destination, strategy: "10", extensions: "all", cartype: "1", output: "JSON" });
  if (waypoint) params.set("waypoints", waypoint);
  const data = await fetchAmapJson<AmapDirectionResponse>(`https://restapi.amap.com/v3/direction/driving?${params}`, 16000);
  if (data.status !== "1") throw new Error(`AMAP_${data.info || "ROUTE_ERROR"}`);
  return data;
}

async function nearbySearch(location: string, keywords: string, radius: number, key: string): Promise<RoutePoi[]> {
  const params = new URLSearchParams({ key, location, keywords, radius: String(radius), sortrule: "distance", page_size: "6", page_num: "1", show_fields: "business,navi", output: "JSON" });
  let data: AmapPlaceResponse;
  try {
    data = await fetchAmapJson<AmapPlaceResponse>(`https://restapi.amap.com/v5/place/around?${params}`, 12000);
  } catch {
    return [];
  }
  if (data.status !== "1") return [];
  return (data.pois ?? []).map(poi => ({
    id: poi.id,
    name: poi.name,
    location: poi.navi?.entr_location || poi.location,
    address: Array.isArray(poi.address) ? poi.address.join("") : poi.address || "地址信息暂缺",
    type: poi.type,
    typecode: poi.typecode,
    distanceMeters: Number(poi.distance || 0),
    parkingType: poi.business?.parking_type || "",
  }));
}

async function fetchAmapJson<T extends { status: string; info: string }>(url: string, timeoutMs: number): Promise<T> {
  let latestError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await pacedAmapFetch(url, timeoutMs);
      if (!response.ok) throw new Error(`AMAP_HTTP_${response.status}`);
      const data = await response.json() as T;
      if (data.status === "1" || !/LIMIT|TIMEOUT|UNAVAILABLE/i.test(data.info || "") || attempt === 1) return data;
      await delay(500 * (attempt + 1));
    } catch (error) {
      latestError = error;
      if (attempt === 1) break;
      await delay(500 * (attempt + 1));
    }
  }
  const message = latestError instanceof Error ? latestError.message : "AMAP_REQUEST_UNAVAILABLE";
  throw new Error(message.includes("timeout") ? "AMAP_REQUEST_TIMEOUT" : message);
}

async function pacedAmapFetch(url: string, timeoutMs: number) {
  const scheduled = amapQueue.then(async () => {
    const waitMs = Math.max(0, 220 - (Date.now() - lastAmapRequestAt));
    if (waitMs) await delay(waitMs);
    lastAmapRequestAt = Date.now();
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  });
  amapQueue = scheduled.then(() => undefined, () => undefined);
  return scheduled;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function routeMidpoint(steps: AmapRouteStep[] | undefined) {
  if (!steps?.length) return "";
  const total = steps.reduce((sum, step) => sum + Number(step.distance || 0), 0);
  let walked = 0;
  for (const step of steps) {
    walked += Number(step.distance || 0);
    if (walked >= total / 2 && step.polyline) {
      const points = step.polyline.split(";");
      return points[Math.floor(points.length / 2)] || "";
    }
  }
  return "";
}

function midpoint(origin: string, destination: string) {
  const [originLng, originLat] = origin.split(",").map(Number);
  const [destinationLng, destinationLat] = destination.split(",").map(Number);
  return `${((originLng + destinationLng) / 2).toFixed(6)},${((originLat + destinationLat) / 2).toFixed(6)}`;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export default worker;
