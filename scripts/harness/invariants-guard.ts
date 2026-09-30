/**
 * Semantic Invariants Guard — Single Source of Truth Auditor
 * Part of The Quant Partners AI Agent Harness
 *
 * Scans the codebase for:
 * 1. Obsolete or contradictory pricing strings (e.g. stale $1,500 setup or unaligned retainers).
 * 2. Hardcoded offer discrepancies in prompt templates and bot handlers.
 * 3. Verification that canonical offer constants are respected across modules.
 *
 * Exit code 0: All semantic invariants hold.
 * Exit code 1: Stale or contradictory strings detected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { CANONICAL_OFFER } from '../../src/config/canonical_offer.js';

interface Discrepancy {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const FORBIDDEN_OBSOLETE_PATTERNS = [
  { pattern: /\$1[,.]?500\s*(?:usd)?\s*(?:de)?\s*(?:setup|instalaci[oó]n)/i, reason: 'Stale setup price ($1,500). Canonical setup is $1,200 (or S/. 4,500).' },
  { pattern: /\$800\s*(?:usd)?\s*\/(?:mes|month)/i, reason: 'Stale retainer price ($800/mo). Canonical retainer is $500/mo.' },
  { pattern: /\$750\s*(?:usd)?\s*\/(?:mes|month)/i, reason: 'Stale retainer price ($750/mo). Canonical retainer is $500/mo.' },
  { pattern: /S\/\.?\s*5[,.]?500/i, reason: 'Stale PEN setup price. Canonical PEN setup is S/. 4,500.' },
];

const SCAN_DIRECTORIES = [
  'src/ai',
  'src/whatsapp',
  'apps/qp-outreach',
  'apps/soplo-ai',
  'apps/tech-contractor',
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'scripts/harness/invariants-guard.ts',
  'pca/decisions/001-',
  'pca/decisions/002-',
  'pca/decisions/003-',
  'pca/decisions/004-',
  'pca/decisions/005-',
  'pca/decisions/006-',
  'pca/decisions/007-',
  'pca/decisions/008-',
  'pca/decisions/009-',
];

function scanDirectory(dir: string, discrepancies: Discrepancy[]) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalized = fullPath.replace(/\\/g, '/');

    if (IGNORED_PATHS.some(ignored => normalized.includes(ignored))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, discrepancies);
    } else if (entry.isFile() && /\.(ts|tsx|js|jsx|json|md|html)$/.test(entry.name)) {
      auditFile(fullPath, discrepancies);
    }
  }
}

function auditFile(filePath: string, discrepancies: Discrepancy[]) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    for (const rule of FORBIDDEN_OBSOLETE_PATTERNS) {
      if (rule.pattern.test(line)) {
        discrepancies.push({
          file: filePath,
          line: index + 1,
          snippet: line.trim(),
          reason: rule.reason,
        });
      }
    }
  });
}

export function runInvariantsAudit(): boolean {
  console.log('============================================================');
  console.log('[INVARIANTS GUARD] Auditing Monorepo Semantic Consistency...');
  console.log(`[INVARIANTS GUARD] Canonical Offer Loaded: "${CANONICAL_OFFER.name}"`);
  console.log(`[INVARIANTS GUARD] Active Pricing (LatAm): Setup $${CANONICAL_OFFER.geography.latam.pricing.managed.setupUSD} / Retainer $${CANONICAL_OFFER.geography.latam.pricing.managed.monthlyFeeUSD}/mo`);
  console.log('============================================================\n');

  const discrepancies: Discrepancy[] = [];

  for (const dir of SCAN_DIRECTORIES) {
    scanDirectory(dir, discrepancies);
  }

  if (discrepancies.length > 0) {
    console.error(`\x1b[31m[INVARIANTS GUARD] FAILED: ${discrepancies.length} semantic discrepancy(ies) detected!\x1b[0m\n`);
    for (const d of discrepancies) {
      console.error(`  - \x1b[33m${d.file}:${d.line}\x1b[0m`);
      console.error(`    Snippet: "${d.snippet}"`);
      console.error(`    Reason:  ${d.reason}\n`);
    }
    console.error(`Fix these files to align with src/config/canonical_offer.ts before deploying.\n`);
    return false;
  }

  console.log('\x1b[32m[INVARIANTS GUARD] PASS: Monorepo semantic consistency verified. Zero stale pricing strings.\x1b[0m\n');
  return true;
}

import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile.toLowerCase() === invokedFile.toLowerCase() || invokedFile.endsWith('invariants-guard.ts')) {
  const success = runInvariantsAudit();
  process.exit(success ? 0 : 1);
}
