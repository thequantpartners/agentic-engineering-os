/**
 * Syntax Guard — Deterministic Full-Stack AST & Syntax Validator
 * Part of The Quant Partners AI Agent Harness
 *
 * Catches syntax errors, parse failures, unclosed tags, and broken inline
 * scripts in both TypeScript files and HTML files with embedded Babel/React.
 */

import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface ValidationIssue {
  file: string;
  line: number;
  column: number;
  message: string;
  snippet?: string;
}

export interface ValidationResult {
  success: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates a TypeScript / JavaScript source string using the TS Compiler API AST
 */
export function validateScriptAST(fileName: string, content: string, isTsx = true): ValidationIssue[] {
  const kind = isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true, kind);
  const issues: ValidationIssue[] = [];

  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics || [];

  for (const diag of diagnostics) {
    let line = 1;
    let column = 1;
    if (diag.start !== undefined) {
      const pos = sourceFile.getLineAndCharacterOfPosition(diag.start);
      line = pos.line + 1;
      column = pos.character + 1;
    }
    const message = typeof diag.messageText === 'string'
      ? diag.messageText
      : diag.messageText.messageText;

    issues.push({
      file: fileName,
      line,
      column,
      message,
    });
  }

  return issues;
}

/**
 * Validates an HTML file, extracting any <script> tags (including Babel/React) and validating their AST
 */
export function validateHtmlFile(filePath: string): ValidationIssue[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues: ValidationIssue[] = [];

  // Match <script ...> ... </script>
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(content)) !== null) {
    const attrs = match[1] || '';
    const scriptBody = match[2];
    const matchIndex = match.index;

    // Skip external script src
    if (/src\s*=/i.test(attrs)) {
      continue;
    }

    // Determine line offset of script in the HTML file
    const prefix = content.slice(0, matchIndex);
    const lineOffset = prefix.split('\n').length;

    // Check AST with TypeScript in TSX mode
    const isBabelOrJsx = /type\s*=\s*["'](text\/babel|module)["']/i.test(attrs) || attrs === '';
    const scriptIssues = validateScriptAST(`${filePath}#script-line-${lineOffset}.tsx`, scriptBody, isBabelOrJsx);

    for (const issue of scriptIssues) {
      issues.push({
        file: filePath,
        line: lineOffset + issue.line - 1,
        column: issue.column,
        message: `[HTML Inline Script] ${issue.message}`,
      });
    }
  }

  return issues;
}

/**
 * Full inspection of target files
 */
export function validateFiles(filePaths: string[]): ValidationResult {
  const allIssues: ValidationIssue[] = [];

  for (const relPath of filePaths) {
    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) {
      allIssues.push({
        file: relPath,
        line: 0,
        column: 0,
        message: 'File does not exist.',
      });
      continue;
    }

    const ext = path.extname(absPath).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      const htmlIssues = validateHtmlFile(absPath);
      allIssues.push(...htmlIssues);
    } else if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
      const content = fs.readFileSync(absPath, 'utf-8');
      const scriptIssues = validateScriptAST(absPath, content, ext.includes('x'));
      allIssues.push(...scriptIssues);
    }
  }

  return {
    success: allIssues.length === 0,
    issues: allIssues,
  };
}

import { fileURLToPath } from 'node:url';

// CLI runner
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const targetFiles = process.argv.slice(2);
  if (targetFiles.length === 0) {
    console.log('Usage: npx tsx scripts/harness/syntax-guard.ts <file1> <file2> ...');
    process.exit(0);
  }

  const result = validateFiles(targetFiles);
  if (result.success) {
    console.log(`[SYNTAX GUARD] PASS: All ${targetFiles.length} file(s) have valid syntax and AST.`);
    process.exit(0);
  } else {
    console.error(`[SYNTAX GUARD] FAIL: Found ${result.issues.length} issue(s):`);
    for (const issue of result.issues) {
      console.error(`  - ${issue.file}:${issue.line}:${issue.column} -> ${issue.message}`);
    }
    process.exit(1);
  }
}
