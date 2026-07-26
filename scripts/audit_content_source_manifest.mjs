#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "config", "content-source-manifest.v1.json");
const issues = [];

function fail(message) {
  issues.push(message);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function resolveProjectPath(relativePath) {
  const resolved = path.resolve(ROOT, relativePath);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`path escapes project root: ${relativePath}`);
  }
  return resolved;
}

function validateLogicalName(value, forbiddenTokens, label) {
  const name = String(value || "");
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z0-9]+$/.test(name)) {
    fail(`${label} is not lowercase ASCII business filename: ${name}`);
  }
  const folded = name.toLowerCase();
  for (const token of forbiddenTokens) {
    if (folded.includes(String(token).toLowerCase())) {
      fail(`${label} contains forbidden token ${token}: ${name}`);
    }
  }
}

function readAndVerifyFile(relativePath, expectedBytes, expectedSha256, label) {
  let absolutePath;
  try {
    absolutePath = resolveProjectPath(relativePath);
  } catch (error) {
    fail(`${label}: ${error.message}`);
    return null;
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    fail(`${label} does not exist as file: ${relativePath}`);
    return null;
  }
  const buffer = fs.readFileSync(absolutePath);
  if (buffer.length !== Number(expectedBytes)) {
    fail(`${label} byte size mismatch: expected ${expectedBytes}, got ${buffer.length}`);
  }
  const actualSha256 = sha256(buffer);
  if (actualSha256 !== expectedSha256) {
    fail(`${label} sha256 mismatch: expected ${expectedSha256}, got ${actualSha256}`);
  }
  return { absolutePath, buffer };
}

function pdfPageCount(absolutePath) {
  const output = execFileSync("pdfinfo", [absolutePath], { encoding: "utf8" });
  const match = output.match(/^Pages:\s+(\d+)\s*$/m);
  return match ? Number(match[1]) : null;
}

function pptxSlideCount(absolutePath) {
  const output = execFileSync("unzip", ["-Z1", absolutePath], { encoding: "utf8" });
  return output
    .split(/\r?\n/)
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))
    .length;
}

function drawioPageCount(buffer) {
  return (buffer.toString("utf8").match(/<diagram\b/g) || []).length;
}

function collectionDigest(directory, fileFilter) {
  const filter = new RegExp(fileFilter, "i");
  const names = fs
    .readdirSync(directory)
    .filter((name) => filter.test(name) && fs.statSync(path.join(directory, name)).isFile())
    .sort();
  const digest = crypto.createHash("sha256");
  let bytes = 0;
  for (const name of names) {
    const buffer = fs.readFileSync(path.join(directory, name));
    bytes += buffer.length;
    digest.update(name);
    digest.update("\0");
    digest.update(crypto.createHash("sha256").update(buffer).digest());
  }
  return {
    count: names.length,
    bytes,
    manifestSha256: digest.digest("hex"),
  };
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const forbiddenTokens = manifest.naming_policy?.forbidden_tokens || [];
const documentIds = new Set();
const stableRefs = new Set();
const logicalNames = new Set();

if (manifest.status !== "t0_frozen") {
  fail(`manifest status must be t0_frozen, got ${manifest.status}`);
}
if (manifest.naming_policy?.rename_original_source_files !== false) {
  fail("T0 must not rename original source files");
}
if (manifest.database_targets?.user_database_access !== "forbidden") {
  fail("user database access must remain forbidden");
}

const serializedManifest = JSON.stringify(manifest);
if (/sapd_wiki_user|data\/user\//i.test(serializedManifest)) {
  fail("manifest must not reference a user database path");
}

for (const [key, value] of Object.entries(manifest.database_targets || {})) {
  if (key.startsWith("candidate_") || key.endsWith("_directory")) {
    const normalized = String(value || "").replaceAll("\\", "/");
    if (!normalized.startsWith("data/exports/worker-verify/base-content-unified-query/")) {
      fail(`${key} must stay under the bounded worker-verify directory`);
    }
  }
}

const baseDatabasePath = resolveProjectPath(manifest.database_targets.formal_query_database);
if (!fs.existsSync(baseDatabasePath)) {
  fail("formal query database is unavailable");
} else {
  const actualBaseDigest = sha256(fs.readFileSync(baseDatabasePath));
  if (actualBaseDigest !== manifest.database_targets.formal_query_database_sha256_before) {
    fail(`formal query database digest drifted: ${actualBaseDigest}`);
  }
}

for (const document of manifest.documents || []) {
  const label = `document ${document.document_id}`;
  if (documentIds.has(document.document_id)) fail(`${label} has duplicate document_id`);
  documentIds.add(document.document_id);
  if (stableRefs.has(document.stable_ref)) fail(`${label} has duplicate stable_ref`);
  stableRefs.add(document.stable_ref);
  if (!String(document.stable_ref || "").startsWith("base:content_document:")) {
    fail(`${label} has invalid stable_ref`);
  }
  validateLogicalName(document.logical_file_name, forbiddenTokens, `${label} logical_file_name`);
  if (logicalNames.has(document.logical_file_name)) fail(`${label} has duplicate logical_file_name`);
  logicalNames.add(document.logical_file_name);
  if (document.inclusion_status !== "approved") fail(`${label} is not approved`);

  const verified = readAndVerifyFile(
    document.source_path,
    document.bytes,
    document.sha256,
    label,
  );
  if (!verified || !document.expected_pages) continue;

  let actualPages = null;
  if (document.format === "pdf") actualPages = pdfPageCount(verified.absolutePath);
  if (document.format === "pptx") actualPages = pptxSlideCount(verified.absolutePath);
  if (document.format === "drawio") actualPages = drawioPageCount(verified.buffer);
  if (actualPages !== Number(document.expected_pages)) {
    fail(`${label} page count mismatch: expected ${document.expected_pages}, got ${actualPages}`);
  }
}

for (const asset of manifest.derived_assets || []) {
  const label = `asset ${asset.asset_id}`;
  if (!documentIds.has(asset.document_id)) fail(`${label} references unknown document`);
  validateLogicalName(asset.logical_file_name, forbiddenTokens, `${label} logical_file_name`);
  if (logicalNames.has(asset.logical_file_name)) fail(`${label} has duplicate logical_file_name`);
  logicalNames.add(asset.logical_file_name);
  for (const sourcePath of asset.source_paths || []) {
    readAndVerifyFile(sourcePath, asset.bytes, asset.sha256, `${label} source ${sourcePath}`);
  }
}

for (const collection of manifest.derived_collections || []) {
  const label = `collection ${collection.collection_id}`;
  if (!documentIds.has(collection.document_id)) fail(`${label} references unknown document`);
  const foldedPattern = String(collection.logical_file_name_pattern || "").toLowerCase();
  for (const token of forbiddenTokens) {
    if (foldedPattern.includes(String(token).toLowerCase())) {
      fail(`${label} logical filename pattern contains forbidden token ${token}`);
    }
  }
  const directory = resolveProjectPath(collection.source_directory);
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) {
    fail(`${label} source directory is missing`);
    continue;
  }
  const actual = collectionDigest(directory, collection.file_filter);
  if (actual.count !== Number(collection.expected_count)) {
    fail(`${label} count mismatch: expected ${collection.expected_count}, got ${actual.count}`);
  }
  if (actual.bytes !== Number(collection.expected_bytes)) {
    fail(`${label} byte size mismatch: expected ${collection.expected_bytes}, got ${actual.bytes}`);
  }
  if (actual.manifestSha256 !== collection.manifest_sha256) {
    fail(`${label} manifest digest mismatch`);
  }
}

for (const exclusion of manifest.excluded_sources || []) {
  const excludedName = path.basename(exclusion.source_path).toLowerCase();
  if (excludedName.startsWith("~$") && !exclusion.reason.includes("temporary")) {
    fail(`Office lock exclusion must identify temporary file: ${exclusion.source_path}`);
  }
}

const poster = (manifest.documents || []).find(
  (document) => document.document_id === "archimate-3.2-reference-poster-zh",
);
if (!poster || poster.ocr_policy !== "never" || poster.semantic_source !== false) {
  fail("ArchiMate Poster must remain manual-catalog-only with OCR disabled");
}

const result = {
  result: issues.length ? "fail" : "pass",
  manifest: path.relative(ROOT, MANIFEST_PATH),
  documentCount: (manifest.documents || []).length,
  derivedAssetCount: (manifest.derived_assets || []).length,
  derivedCollectionCount: (manifest.derived_collections || []).length,
  stableRefCount: stableRefs.size,
  logicalFileNameCount: logicalNames.size,
  issues,
};

console.log(JSON.stringify(result, null, 2));
if (issues.length) process.exitCode = 1;
