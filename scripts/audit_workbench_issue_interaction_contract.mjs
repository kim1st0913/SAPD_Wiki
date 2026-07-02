import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appPath = path.join(root, "frontend/capability-browser/app.js");
const shellPath = path.join(root, "frontend/capability-browser/components/AppShell.js");
const indexPath = path.join(root, "frontend/capability-browser/index.html");

const app = fs.readFileSync(appPath, "utf8");
const shell = fs.readFileSync(shellPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");

const checks = [
  {
    name: "workbench-parent-is-expand-only",
    ok: !shell.includes("parentRouteAttrs") && !shell.includes('"${parentRouteAttrs}"') && !shell.includes("}${parentRouteAttrs}>"),
  },
  {
    name: "workbench-subroute-preserved",
    ok: app.includes('view === "workbench" && normalizeAppRoute(state.activeRoute).startsWith("/workbench")'),
  },
  {
    name: "app-route-capture-handler",
    ok:
      app.includes('const routeButton = event.target?.closest?.("[data-app-route]");') &&
      app.includes("event.stopPropagation();") &&
      app.includes("}, true);"),
  },
  {
    name: "issue-item-select-helper",
    ok: app.includes("function selectWorkbenchReviewItem(reviewItem)") && app.includes("updateWorkbenchReviewInspector(reviewItem);"),
  },
  {
    name: "checkbox-click-enters-item",
    ok: /const reviewItem = event\.target\.closest\("\[data-review-item\]"\);[\s\S]*?!event\.target\.closest\("select, textarea, button"\)[\s\S]*?selectWorkbenchReviewItem\(reviewItem\);/.test(app),
  },
  {
    name: "issue-item-keyboard-entry",
    ok: app.includes('event.key !== "Enter" && event.key !== " "') && app.includes("selectWorkbenchReviewItem(reviewItem);"),
  },
  {
    name: "issue-item-a11y-target",
    ok: app.includes('role="button" tabindex="0" data-review-item'),
  },
  {
    name: "cache-busted",
    ok: index.includes("issue-list-click-20260701-3"),
  },
];

const failed = checks.filter((check) => !check.ok);

console.log(
  JSON.stringify(
    {
      result: failed.length ? "fail" : "pass",
      failed: failed.map((check) => check.name),
      checks,
    },
    null,
    2,
  ),
);

if (failed.length) process.exit(1);
