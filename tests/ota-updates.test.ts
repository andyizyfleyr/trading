import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/updates/route";
import otaManifestData from "@/lib/ota-manifest.json";

const ROOT = process.cwd();

function parseMultipartParts(body: string, contentType: string): Record<string, unknown> {
  const match = contentType.match(/boundary="?([^";]+)"?/i);
  assert.ok(match, `Boundary manquant dans Content-Type: ${contentType}`);
  const boundary = match[1];
  const rawParts = body.split(`--${boundary}`);
  const result: Record<string, unknown> = {};
  for (const part of rawParts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed === "--") continue;
    const sepIndex = part.indexOf("\r\n\r\n");
    assert.ok(sepIndex !== -1, "Séparateur CRLF CRLF manquant dans une partie multipart");
    const headerBlock = part.slice(0, sepIndex);
    const payload = part.slice(sepIndex + 4).replace(/\r\n$/, "");
    const nameMatch = headerBlock.match(/name="([^"]+)"/i);
    assert.ok(nameMatch, `Nom de partie manquant dans: ${headerBlock}`);
    result[nameMatch[1]] = JSON.parse(payload);
  }
  return result;
}

test("GET /api/updates retourne un manifeste Expo Updates Protocol v1 valide pour Android 1.0.0", async () => {
  const req = new NextRequest("https://tradefacile-sand.vercel.app/api/updates", {
    headers: {
      accept: "multipart/mixed,application/expo+json,application/json",
      "expo-platform": "android",
      "expo-protocol-version": "1",
      "expo-api-version": "1",
      "expo-runtime-version": "1.0.0",
      host: "tradefacile-sand.vercel.app",
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("expo-protocol-version"), "1");
  assert.equal(res.headers.get("expo-sfv-version"), "0");
  assert.equal(res.headers.get("cache-control"), "private, max-age=0");

  const ct = res.headers.get("content-type") || "";
  assert.ok(ct.startsWith("multipart/mixed;"), `Content-Type multipart attendu, reçu: ${ct}`);

  const parts = parseMultipartParts(await res.text(), ct);
  assert.ok(parts.manifest, "Partie manifest attendue");
  assert.ok(parts.extensions, "Partie extensions attendue");

  const manifest = parts.manifest as {
    id: string;
    createdAt: string;
    runtimeVersion: string;
    launchAsset: { hash: string; key: string; fileExtension: string; contentType: string; url: string };
    assets: Array<{ hash: string; key: string; fileExtension: string; contentType: string; url: string }>;
    extra: { scopeKey: string };
  };

  assert.match(
    manifest.id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "UUID RFC-4122 attendu"
  );
  assert.equal(manifest.runtimeVersion, "1.0.0");
  assert.equal(manifest.extra.scopeKey, "com.tradefacile.mobile");
  assert.ok(manifest.launchAsset.url.startsWith("https://tradefacile-sand.vercel.app/ota/1.0.0/bundles/"));

  // Vérifie que le bundle .hbc existe réellement sur disque et que son hash SHA-256 base64url correspond.
  const bundleRelPath = new URL(manifest.launchAsset.url).pathname.replace(/^\//, "");
  const bundleFullPath = path.join(ROOT, "public", bundleRelPath);
  assert.ok(fs.existsSync(bundleFullPath), `Bundle OTA introuvable sur disque : ${bundleFullPath}`);
  const bundleBytes = fs.readFileSync(bundleFullPath);
  const actualHash = crypto.createHash("sha256").update(bundleBytes).digest("base64url");
  assert.equal(manifest.launchAsset.hash, actualHash, "Le hash SHA-256 base64url du bundle doit correspondre");
});

test("GET /api/updates retourne la directive noUpdateAvailable quand le téléphone est déjà à jour", async () => {
  const latestId = otaManifestData.runtimes["1.0.0"].android.id;
  const req = new NextRequest("https://tradefacile-sand.vercel.app/api/updates", {
    headers: {
      "expo-platform": "android",
      "expo-protocol-version": "1",
      "expo-runtime-version": "1.0.0",
      "expo-current-update-id": latestId,
      host: "tradefacile-sand.vercel.app",
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);
  const parts = parseMultipartParts(await res.text(), res.headers.get("content-type") || "");
  assert.deepEqual(parts.directive, { type: "noUpdateAvailable" });
  assert.equal(parts.manifest, undefined);
});

test("GET /api/updates retourne noUpdateAvailable pour une version runtime inconnue", async () => {
  const req = new NextRequest("https://tradefacile-sand.vercel.app/api/updates", {
    headers: {
      "expo-platform": "android",
      "expo-protocol-version": "1",
      "expo-runtime-version": "9.9.9",
      host: "tradefacile-sand.vercel.app",
    },
  });

  const res = await GET(req);
  assert.equal(res.status, 200);
  const parts = parseMultipartParts(await res.text(), res.headers.get("content-type") || "");
  assert.deepEqual(parts.directive, { type: "noUpdateAvailable" });
});

test("GET /api/updates?format=json renvoie le manifeste JSON pour inspection", async () => {
  const req = new NextRequest(
    "https://tradefacile-sand.vercel.app/api/updates?platform=android&runtime-version=1.0.0&format=json",
    { headers: { host: "tradefacile-sand.vercel.app" } }
  );
  const res = await GET(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.runtimeVersion, "1.0.0");
  assert.equal(json.id, otaManifestData.runtimes["1.0.0"].android.id);
});
