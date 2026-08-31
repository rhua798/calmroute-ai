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
      steps?: Array<{ instruction: string; road: string; distance: string; action: string }>;
    }>;
  };
};

async function handleRouteRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  if (!env.AMAP_WEB_SERVICE_KEY) return json({ error: "AMAP_KEY_NOT_CONFIGURED" }, 503);

  try {
    const body = await request.json() as { origin?: unknown; destination?: unknown };
    const originName = normalizePlace(body.origin);
    const destinationName = normalizePlace(body.destination);
    if (!originName || !destinationName) return json({ error: "INVALID_PLACE" }, 400);

    const [origin, destination] = await Promise.all([
      geocode(originName, env.AMAP_WEB_SERVICE_KEY),
      geocode(destinationName, env.AMAP_WEB_SERVICE_KEY),
    ]);
    const direction = await drivingRoute(origin.location, destination.location, env.AMAP_WEB_SERVICE_KEY);
    const paths = direction.route?.paths ?? [];
    if (!paths.length) return json({ error: "ROUTE_NOT_FOUND" }, 404);

    return json({
      source: "amap",
      origin: { name: originName, ...origin },
      destination: { name: destinationName, ...destination },
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

function normalizePlace(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().replace(/[<>]/g, "");
  return trimmed.length >= 2 && trimmed.length <= 80 ? trimmed : "";
}

async function geocode(address: string, key: string) {
  const params = new URLSearchParams({ key, address, output: "JSON" });
  const response = await fetch(`https://restapi.amap.com/v3/geocode/geo?${params}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("AMAP_GEOCODE_UNAVAILABLE");
  const data = await response.json() as AmapGeocodeResponse;
  const result = data.geocodes?.[0];
  if (data.status !== "1" || !result?.location) throw new Error(data.info === "OK" ? "PLACE_NOT_FOUND" : `AMAP_${data.info || "GEOCODE_ERROR"}`);
  return { formattedAddress: result.formatted_address, location: result.location, city: String(result.city || ""), district: result.district };
}

async function drivingRoute(origin: string, destination: string, key: string) {
  const params = new URLSearchParams({ key, origin, destination, strategy: "10", extensions: "all", cartype: "1", output: "JSON" });
  const response = await fetch(`https://restapi.amap.com/v3/direction/driving?${params}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("AMAP_ROUTE_UNAVAILABLE");
  const data = await response.json() as AmapDirectionResponse;
  if (data.status !== "1") throw new Error(`AMAP_${data.info || "ROUTE_ERROR"}`);
  return data;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

export default worker;
