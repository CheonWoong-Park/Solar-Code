#!/usr/bin/env node
import { clearSolarCodeHome, getSolarCodeHome } from '@solar-code/core';

try {
  const home = getSolarCodeHome();
  clearSolarCodeHome();
  process.stdout.write(`Removed Solar Code user data: ${home}\n`);
} catch {
  // Uninstall cleanup is best-effort.
}
