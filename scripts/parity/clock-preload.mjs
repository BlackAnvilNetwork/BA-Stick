// Copyright (c) 2026 Black Anvil Network
// SPDX-License-Identifier: AGPL-3.0-or-later
// Test-only clock shim for the parity harness. Lets the harness move the
// server's wall clock forward (listing min-lifetime, 7-day ask window) without
// changing server code. SIGUSR2 re-reads the offset (ms) from PARITY_CLOCK_FILE.
import { readFileSync } from "node:fs";
const file = process.env.PARITY_CLOCK_FILE;
let offset = 0;
const realNow = Date.now.bind(Date);
const read = () => {
  try { offset = Number(readFileSync(file, "utf8")) || 0; } catch { /* keep */ }
};
if (file) {
  read();
  process.on("SIGUSR2", read);
}
Date.now = () => realNow() + offset;
