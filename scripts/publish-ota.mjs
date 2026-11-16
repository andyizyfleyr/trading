#!/usr/bin/env node
/**
 * Exporte le bundle Expo Android (Hermes) et met à jour le manifeste OTA
 * auto-hébergé servi par GET /api/updates (protocole Expo Updates v1).
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE_DIR = path.join(ROOT, "mobile");
const EXPORT_DIR = path.join(MOBILE_DIR, "dist-ota");
const MANIFEST_OUT = path.join(ROOT, "lib", "ota-manifest.json");

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",
  json: "application/json",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

function sha256Base64Url(buf) {
  return crypto.createHash("sha256").update(buf).digest("base64url");
}

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function deterministicUuid(seed) {
  const bytes = crypto.createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant RFC 4122
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const appConfig = JSON.parse(fs.readFileSync(path.join(MOBILE_DIR, "app.json"), "utf8"));
const expoConfig = appConfig.expo;
const runtimeVersion = String(expoConfig.runtimeVersion || expoConfig.version || "1.0.0");

fs.rmSync(EXPORT_DIR, { recursive: true, force: true });

console.log(`Export Expo Android OTA (runtimeVersion=${runtimeVersion})…`);
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["expo", "export", "--platform", "android", "--output-dir", EXPORT_DIR],
  { cwd: MOBILE_DIR, stdio: "inherit" }
);

const metadataPath = path.join(EXPORT_DIR, "metadata.json");
const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
const androidMeta = metadata?.fileMetadata?.android;
if (!androidMeta?.bundle) {
  throw new Error("Bundle Android introuvable dans dist-ota/metadata.json");
}

const publicRuntimeDir = path.join(ROOT, "public", "ota", runtimeVersion);
const bundlesDir = path.join(publicRuntimeDir, "bundles");
const assetsDir = path.join(publicRuntimeDir, "assets");
fs.rmSync(publicRuntimeDir, { recursive: true, force: true });
fs.mkdirSync(bundlesDir, { recursive: true });
fs.mkdirSync(assetsDir, { recursive: true });

const bundleSrc = path.join(EXPORT_DIR, androidMeta.bundle);
const bundleBytes = fs.readFileSync(bundleSrc);
const bundleHash = sha256Base64Url(bundleBytes);
const bundleKey = sha256Hex(bundleBytes).slice(0, 32);
const bundleFilename = `bundle-${bundleKey}.hbc`;
fs.writeFileSync(path.join(bundlesDir, bundleFilename), bundleBytes);

const assets = [];
for (const item of androidMeta.assets || []) {
  const src = path.join(EXPORT_DIR, item.path);
  const bytes = fs.readFileSync(src);
  const ext = String(item.ext || "").replace(/^\./, "").toLowerCase();
  const key = path.basename(item.path);
  const fileName = ext ? `${key}.${ext}` : key;
  fs.writeFileSync(path.join(assetsDir, fileName), bytes);
  assets.push({
    hash: sha256Base64Url(bytes),
    key,
    fileExtension: ext ? `.${ext}` : "",
    contentType: MIME_BY_EXT[ext] || "application/octet-stream",
    path: `/ota/${runtimeVersion}/assets/${fileName}`,
  });
}

const seed = JSON.stringify({
  runtimeVersion,
  bundleHash,
  assets: assets.map((a) => `${a.key}:${a.hash}`).sort(),
});
const updateId = deterministicUuid(seed);

let existing = { runtimes: {} };
if (fs.existsSync(MANIFEST_OUT)) {
  try {
    existing = JSON.parse(fs.readFileSync(MANIFEST_OUT, "utf8"));
  } catch {
    existing = { runtimes: {} };
  }
}

const prevEntry = existing?.runtimes?.[runtimeVersion]?.android;
const createdAt =
  prevEntry && prevEntry.id === updateId && typeof prevEntry.createdAt === "string"
    ? prevEntry.createdAt
    : new Date().toISOString();

existing.runtimes = existing.runtimes || {};
existing.runtimes[runtimeVersion] = {
  ...(existing.runtimes[runtimeVersion] || {}),
  android: {
    id: updateId,
    createdAt,
    runtimeVersion,
    launchAsset: {
      hash: bundleHash,
      key: bundleKey,
      fileExtension: ".bundle",
      contentType: "application/javascript",
      path: `/ota/${runtimeVersion}/bundles/${bundleFilename}`,
    },
    assets,
    extra: {
      scopeKey: expoConfig.android?.package || "com.tradefacile.mobile",
      expoClient: expoConfig,
    },
  },
};

fs.writeFileSync(MANIFEST_OUT, JSON.stringify(existing, null, 2) + "\n", "utf8");
fs.rmSync(EXPORT_DIR, { recursive: true, force: true });

console.log(
  `OTA publié : runtime=${runtimeVersion}, id=${updateId}, bundle=${bundleFilename} (${(
    bundleBytes.length /
    (1024 * 1024)
  ).toFixed(2)} Mo), assets=${assets.length}.`
);
