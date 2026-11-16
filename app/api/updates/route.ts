import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import otaManifestData from "@/lib/ota-manifest.json";

export const dynamic = "force-dynamic";

interface OtaAssetRecord {
  hash: string;
  key: string;
  fileExtension: string;
  contentType: string;
  path: string;
}

interface OtaPlatformEntry {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: OtaAssetRecord;
  assets: OtaAssetRecord[];
  extra: Record<string, unknown>;
}

interface OtaManifestStore {
  runtimes: Record<string, Record<string, OtaPlatformEntry | undefined> | undefined>;
}

const store = otaManifestData as OtaManifestStore;

const FALLBACK_ORIGIN = "https://tradefacile-sand.vercel.app";

function resolveOrigin(req: NextRequest): string {
  if (process.env.OTA_PUBLIC_ORIGIN) {
    return process.env.OTA_PUBLIC_ORIGIN.replace(/\/$/, "");
  }
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (forwardedHost) {
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(forwardedHost);
    const proto = isLocal ? (req.headers.get("x-forwarded-proto") || "http") : "https";
    return `${proto}://${forwardedHost}`;
  }
  return req.nextUrl?.origin && req.nextUrl.origin !== "null"
    ? req.nextUrl.origin
    : FALLBACK_ORIGIN;
}

function buildMultipart(parts: Array<{ name: string; body: unknown }>): Response {
  const boundary = `expo-updates-${crypto.randomBytes(12).toString("hex")}`;
  const chunks: string[] = [];
  for (const part of parts) {
    chunks.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${part.name}"\r\n` +
        `Content-Type: application/json; charset=utf-8\r\n\r\n` +
        `${JSON.stringify(part.body)}\r\n`
    );
  }
  chunks.push(`--${boundary}--\r\n`);

  return new Response(chunks.join(""), {
    status: 200,
    headers: {
      "expo-protocol-version": "1",
      "expo-sfv-version": "0",
      "cache-control": "private, max-age=0",
      "content-type": `multipart/mixed; boundary="${boundary}"`,
    },
  });
}

function noUpdateResponse(): Response {
  return buildMultipart([
    {
      name: "directive",
      body: { type: "noUpdateAvailable" },
    },
  ]);
}

/**
 * GET /api/updates — Serveur OTA auto-hébergé compatible Expo Updates Protocol v1.
 * Utilisé automatiquement par expo-updates dans l'APK Android (mobile/app.json).
 */
export async function GET(req: NextRequest) {
  const platform = (
    req.headers.get("expo-platform") ||
    req.nextUrl.searchParams.get("platform") ||
    "android"
  ).toLowerCase();

  const runtimeVersion =
    req.headers.get("expo-runtime-version") ||
    req.nextUrl.searchParams.get("runtime-version") ||
    "";

  const currentUpdateId = req.headers.get("expo-current-update-id");
  const embeddedUpdateId = req.headers.get("expo-embedded-update-id");
  const format = req.nextUrl.searchParams.get("format");

  const entry = runtimeVersion ? store.runtimes?.[runtimeVersion]?.[platform] : undefined;

  if (!entry) {
    if (format === "json") {
      return NextResponse.json(
        { ok: false, message: "Aucune mise à jour pour cette version runtime/plateforme." },
        { status: 404 }
      );
    }
    return noUpdateResponse();
  }

  if (
    (currentUpdateId && currentUpdateId === entry.id) ||
    (!currentUpdateId && embeddedUpdateId && embeddedUpdateId === entry.id)
  ) {
    if (format === "json") {
      return NextResponse.json({ status: "up-to-date", id: entry.id, runtimeVersion });
    }
    return noUpdateResponse();
  }

  const origin = resolveOrigin(req);
  const manifest = {
    id: entry.id,
    createdAt: entry.createdAt,
    runtimeVersion: entry.runtimeVersion,
    launchAsset: {
      hash: entry.launchAsset.hash,
      key: entry.launchAsset.key,
      fileExtension: entry.launchAsset.fileExtension,
      contentType: entry.launchAsset.contentType,
      url: `${origin}${entry.launchAsset.path}`,
    },
    assets: entry.assets.map((asset) => ({
      hash: asset.hash,
      key: asset.key,
      fileExtension: asset.fileExtension,
      contentType: asset.contentType,
      url: `${origin}${asset.path}`,
    })),
    metadata: {},
    extra: entry.extra,
  };

  if (format === "json") {
    return NextResponse.json(manifest, {
      headers: {
        "expo-protocol-version": "1",
        "expo-sfv-version": "0",
        "cache-control": "private, max-age=0",
      },
    });
  }

  return buildMultipart([
    { name: "manifest", body: manifest },
    { name: "extensions", body: { assetRequestHeaders: {} } },
  ]);
}
