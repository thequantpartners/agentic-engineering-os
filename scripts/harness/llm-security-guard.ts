/**
 * LLM Security & Defensive SRE Guard
 * Part of The Quant Partners AI Agent Harness
 *
 * Scans the codebase for LLM API integrations (OpenRouter, Groq, OpenAI, etc.) to ensure:
 * 1. Mandatory Defensive Timeout: All HTTP fetch requests to LLM completion endpoints
 *    must specify an AbortSignal timeout to prevent hanging connections in VPS/workers.
 * 2. Mandatory Token Limits (Denial of Wallet Defense): All chat completion payloads
 *    must specify max_tokens (or max_completion_tokens) to prevent token exhaustion loops.
 *
 * Exit code 0: All LLM integrations adhere to defensive security standards.
 * Exit code 1: Unprotected or unbounded LLM calls detected.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface SecurityViolation {
  file: string;
  line: number;
  snippet: string;
  rule: string;
  remediation: string;
}

const SCAN_DIRECTORIES = [
  'src/ai',
  'src/copilot',
  'src/hermes',
  'src/gateway',
  'apps/qp-outreach',
  'apps/soplo-ai',
  'apps/tech-contractor',
];

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'scripts/harness/llm-security-guard.ts',
];

function scanDirectory(dir: string, violations: SecurityViolation[]) {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const normalized = fullPath.replace(/\\/g, '/');

    if (IGNORED_PATHS.some(ignored => normalized.includes(ignored))) {
      continue;
    }

    if (entry.isDirectory()) {
      scanDirectory(fullPath, violations);
    } else if (entry.isFile() && /\.(ts|tsx|js)$/.test(entry.name)) {
      auditFile(fullPath, violations);
    }
  }
}

function auditFile(filePath: string, violations: SecurityViolation[]) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Detect if file contains LLM chat completion endpoints
  const isLlmCaller = /chat\/completions|groq\.com\/openai\/v1/i.test(content);
  if (!isLlmCaller) return;

  const lines = content.split('\n');

  // Locate fetch blocks calling LLM endpoints
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/fetch\s*\(\s*(['"`].*?(?:chat\/completions|groq\.com\/openai).*?['"`]|endpoint|url|provider\.url)/.test(line)) {
      // Look ahead up to 35 lines to inspect the fetch options block
      const windowEnd = Math.min(lines.length, i + 35);
      const windowText = lines.slice(i, windowEnd).join('\n');

      const hasSignalTimeout = /signal\s*:\s*(?:AbortSignal\.timeout|controller\.signal)/.test(windowText);
      const hasMaxTokens = /max_tokens\s*:|max_completion_tokens\s*:/i.test(windowText);

      const isAudioTranscription = /audio\/transcriptions/i.test(windowText) || /transcribe/i.test(line);
      const isModelListing = /v1\/models/i.test(line) || /v1\/models/i.test(windowText);

      if (!hasSignalTimeout) {
        violations.push({
          file: filePath,
          line: i + 1,
          snippet: line.trim(),
          rule: 'DEFENSIVE_TIMEOUT_MISSING',
          remediation: 'Add `signal: AbortSignal.timeout(<ms>)` to prevent process deadlocks if the upstream provider hangs.',
        });
      }

      if (!isAudioTranscription && !isModelListing && !hasMaxTokens) {
        violations.push({
          file: filePath,
          line: i + 1,
          snippet: line.trim(),
          rule: 'DENIAL_OF_WALLET_UNBOUNDED',
          remediation: 'Specify `max_tokens` in the request body to prevent unbounded token burning.',
        });
      }
    }
  }
}

export function runLlmSecurityAudit(): boolean {
  console.log('============================================================');
  console.log('[LLM SECURITY GUARD] Auditing Defensive SRE & Token Bounds...');
  console.log('============================================================\n');

  const violations: SecurityViolation[] = [];

  for (const dir of SCAN_DIRECTORIES) {
    scanDirectory(dir, violations);
  }

  if (violations.length > 0) {
    console.error(`\x1b[31m[LLM SECURITY GUARD] FAILED: ${violations.length} LLM security/resilience violation(s) detected!\x1b[0m\n`);
    for (const v of violations) {
      console.error(`  - \x1b[33m${v.file}:${v.line}\x1b[0m`);
      console.error(`    Rule:        [${v.rule}]`);
      console.error(`    Call:        "${v.snippet}"`);
      console.error(`    Remediation: ${v.remediation}\n`);
    }
    return false;
  }

  console.log('\x1b[32m[LLM SECURITY GUARD] PASS: All LLM integrations implement defensive timeouts and bounded token limits.\x1b[0m\n');
  return true;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile.toLowerCase() === invokedFile.toLowerCase() || invokedFile.endsWith('llm-security-guard.ts')) {
  const success = runLlmSecurityAudit();
  process.exit(success ? 0 : 1);
}
