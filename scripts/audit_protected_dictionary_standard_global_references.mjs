#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync("python3", ["scripts/audit_protected_dictionary_standard_global_integrity.py"], {
  cwd: process.cwd(),
  stdio: "inherit",
});

process.exit(result.status ?? 1);
