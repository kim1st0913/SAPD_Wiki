#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFrontendRegistry, renderGeneratedRegistry } from "./generate_frontend_archimate_registry.mjs";

const OUTPUT_PATH = resolve("frontend/capability-browser/generated/archimateNotationRegistry.generated.js");
const expected = renderGeneratedRegistry(buildFrontendRegistry());
const actual = readFileSync(OUTPUT_PATH, "utf8");
const expectedRegistry = buildFrontendRegistry();

const checks = [
  {
    id: "generated_file_matches_config",
    ok: actual === expected,
  },
  {
    id: "frontend_registry_count",
    ok: Object.keys(expectedRegistry).length === 17,
    actual: Object.keys(expectedRegistry).length,
  },
  {
    id: "no_handwritten_frontend_registry",
    ok: !/const ARCHIMATE_NOTATION_REGISTRY = \{/.test(readFileSync("frontend/capability-browser/app.js", "utf8")),
  },
  {
    id: "app_loads_generated_registry",
    ok: readFileSync("frontend/capability-browser/index.html", "utf8").includes("generated/archimateNotationRegistry.generated.js"),
  },
];

const failed = checks.filter((check) => !check.ok);

console.log(
  JSON.stringify(
    {
      result: failed.length ? "fail" : "pass",
      checks,
      failed: failed.map((check) => check.id),
    },
    null,
    2,
  ),
);

if (failed.length) process.exit(1);
