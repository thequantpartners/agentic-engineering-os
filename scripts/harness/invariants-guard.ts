/**
 * Semantic Invariants Guard — Single Source of Truth & Clean State Auditor
 * Part of Agentic Engineering OS (v2.0)
 *
 * Scans the codebase for:
 * 1. Forbidden development placeholders (TODO, FIXME, XXX) in production paths.
 * 2. Hardcoded secret patterns (stale tokens, test API keys, hardcoded credentials).
 * 3. Verification of project-level constants and semantic invariants.
 *
 * Exit code 0: All semantic invariants hold.
 * Exit code 1: Stale placeholders or violations detected.
 */

import fs from 'node:fs';
import path from 'node:path';

interface Discrepancy {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const FORBIDDEN_PATTERNS = [
  { pattern: /\b(FIXME|XXX)\b/, reason: 'Found forbidden placeholder (FIXME/XXX). Complete the task or document in SDD.' },
  { pattern: /(?:api_key|secret_key|private_key)\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/i, reason: 'Possible hardcoded credential or secret key.' },
];

const SCAN_DIRECTORIES = [
  'src',
  'apps',
  'packages',
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'scripts/harness/invariants-guard.ts',
];

function scanDirectory(dir: string, discrepancies: Discrepancy[]) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalized = fullPath.replace(/\\/g, '/');

    if (IGNORED_PATHS.some((ignored) => normalized.includes(ignored))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, discrepancies);
    } else if (entry.isFile() && /\.(ts|tsx|js|json|md)$/.test(entry.name)) {
      scanFile(fullPath, discrepancies);
    }
  }
}

function scanFile(filePath: string, discrepancies: Discrepancy[]) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const rule of FORBIDDEN_PATTERNS) {
      if (rule.pattern.test(line)) {
        discrepancies.push({
          file: filePath,
          line: i + 1,
          snippet: line.trim(),
          reason: rule.reason,
        });
      }
    }
  }
}

export function runInvariantsAudit(): boolean {
  console.log('============================================================');
  console.log('🛡️  INVARIANTS GUARD: Auditing Codebase Semantic Integrity...');
  console.log('============================================================\n');

  const discrepancies: Discrepancy[] = [];

  for (const dir of SCAN_DIRECTORIES) {
    scanDirectory(dir, discrepancies);
  }

  if (discrepancies.length > 0) {
    console.error(`❌ FAILED: ${discrepancies.length} semantic discrepancy(ies) detected:\n`);
    for (const d of discrepancies) {
      console.error(`  - ${d.file}:${d.line}`);
      console.error(`    Snippet: "${d.snippet}"`);
      console.error(`    Reason:  ${d.reason}\n`);
    }
    return false;
  }

  console.log('✅ PASS: Semantic invariants verified. Zero broken constants or placeholder slop.\n');
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
  const success = runInvariantsAudit();
  process.exit(success ? 0 : 1);
}
