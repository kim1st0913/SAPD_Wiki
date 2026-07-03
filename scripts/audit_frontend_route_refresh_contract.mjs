#!/usr/bin/env node
import { readFileSync } from "node:fs";

const appSource = readFileSync("frontend/capability-browser/app.js", "utf8");

const checks = [
  {
    id: "hash_route_priority",
    ok:
      /function routeFromBrowserLocation\(\)[\s\S]*window\.location\.hash[\s\S]*if \(hashRoute !== "\/"\) return hashRoute;/.test(appSource) ||
      /function routeFromBrowserLocation\(\)[\s\S]*const rawHashRoute = text\(window\.location\.hash \|\| ""\)\.trim\(\);[\s\S]*const hashRoute = normalizeAppRoute\(rawHashRoute\);[\s\S]*if \(hashRoute !== "\/"\) return rawHashRoute\.startsWith\("#"\) \? rawHashRoute\.slice\(1\) : rawHashRoute;/.test(appSource),
  },
  {
    id: "root_route_is_not_restored_route",
    ok: /const browserRoute = routeFromBrowserLocation\(\);[\s\S]*const initialRoute = browserRoute;[\s\S]*activateRoute\(initialRoute, \{ replace: true \}\);/.test(appSource),
  },
  {
    id: "canonical_route_base",
    ok: /function appRouteBasePath\(\)[\s\S]*\/frontend\/capability-browser[\s\S]*return "\/";/.test(appSource),
  },
  {
    id: "sync_route_uses_canonical_base",
    ok: /const nextPath = appRouteBasePath\(\);[\s\S]*const nextUrl = `\$\{nextPath\}\$\{window\.location\.search\}\$\{nextHash\}`;/.test(appSource),
  },
  {
    id: "modeling_tab_persisted",
    ok: appSource.includes("activeModelingLanguageTab: state.activeModelingLanguageTab"),
  },
  {
    id: "modeling_tab_restored",
    ok: appSource.includes("state.activeModelingLanguageTab = snapshot.activeModelingLanguageTab || state.activeModelingLanguageTab"),
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
