#!/usr/bin/env node
/**
 * scripts/harness/sdd-guard.ts
 * Arnés determinista de validación Spec-Driven Development (SDD-6).
 * The Quant Partners — Elite Digital Engineering Department
 * 
 * Invariantes Enforced:
 * 1. Validez de Frontmatter YAML tipado (id, tier, status, flags booleanos, slos).
 * 2. Anti-Slop / Anti-Reward Hacking: Prohíbe terminantemente TODO, TBD, N/A, Lorem Ipsum y celdas vacías.
 * 3. Presencia de los 6 bloques canónicos con modularidad por Tier (L1-patch, L2-feature, L3-system).
 * 4. Matriz FMEA de resiliencia obligatoria con al menos 3 vectores de fallo documentados.
 * 5. Diagramas Mermaid con caminos de fallo (stateDiagram-v2 / sequenceDiagram / flowchart).
 * 6. Matriz de los 4 estados UI (Loading, Empty, Error, Success) si has_ui === true.
 * 7. Contratos tipados en código real (TypeScript / SQL / Prisma) y checklist Zero-Trust.
 * 8. Plan de fases donde cada fase cuenta con directiva **Verify:** `comando`.
 * 
 * Uso:
 *   npx tsx scripts/harness/sdd-guard.ts [ruta_al_spec.md] [--require-approved]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SddFrontmatter {
  id?: string;
  title?: string;
  tier?: 'L1-patch' | 'L2-feature' | 'L3-system';
  status?: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'IMPLEMENTED';
  owner?: string;
  has_ui?: boolean;
  has_db?: boolean;
  has_external_io?: boolean;
  max_latency_p95_ms?: number;
  max_cost_per_exec_usd?: number;
}

export interface ValidationIssue {
  ruleId: string;
  severity: 'ERROR' | 'WARN';
  section: string;
  message: string;
}

const BANNED_SLOP_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(TODO\b|Todo:|TBD\b|tbd\b|FIXME|fixme|XXX|xxx)/, label: 'Marcador incompleto (TODO/TBD/FIXME)' },
  { regex: /\blorem ipsum\b/i, label: 'Texto de relleno (Lorem Ipsum)' },
  { regex: /\b(por definir|a definir|pendiente de definir|se definir[aá] luego)\b/i, label: 'Evasión semántica en español' },
  { regex: /^\s*(N\/A|No aplica|Ninguno)\s*$/im, label: 'Sección evadida con "N/A" o "No aplica" (usa flags en frontmatter en su lugar)' },
  { regex: /\|\s*(N\/A|No aplica|-|\?)\s*\|/i, label: 'Celda de tabla evadida con N/A, guion vacío o interrogación' },
];

const REQUIRED_SECTIONS = [
  { id: 'SEC_1', pattern: /^##\s+1\.\s+PRD/m, name: '1. PRD & Business Invariants' },
  { id: 'SEC_2', pattern: /^##\s+2\.\s+TRD/m, name: '2. TRD, Resilience (FMEA) & FinOps' },
  { id: 'SEC_3', pattern: /^##\s+3\.\s+App\s*\/\s*System Flow/m, name: '3. App / System Flow' },
  { id: 'SEC_4', pattern: /^##\s+4\.\s+Design Brief/m, name: '4. Design Brief & UI State Matrix' },
  { id: 'SEC_5', pattern: /^##\s+5\.\s+Backend Schema/m, name: '5. Backend Schema, Data Contracts & Zero-Trust' },
  { id: 'SEC_6', pattern: /^##\s+6\.\s+Implementation Plan/m, name: '6. Implementation Plan & Verification Gates' },
];

function stripHtmlComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '');
}

function parseFrontmatter(raw: string): { fm: SddFrontmatter; body: string; error?: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { fm: {}, body: raw, error: 'El documento no contiene un bloque YAML Frontmatter válido al inicio (---).' };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const fm: Record<string, unknown> = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed === 'slos:') continue;
    const kvMatch = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.+)$/);
    if (!kvMatch) continue;

    const key = kvMatch[1];
    let val: string | boolean | number = kvMatch[2].replace(/#.*$/, '').trim();
    val = val.replace(/^["']|["']$/g, '');

    if (val === 'true') fm[key] = true;
    else if (val === 'false') fm[key] = false;
    else if (!Number.isNaN(Number(val)) && val !== '') fm[key] = Number(val);
    else fm[key] = val;
  }

  return { fm: fm as SddFrontmatter, body };
}

function extractSections(body: string): Record<string, string> {
  const matches: Array<{ id: string; index: number }> = [];

  for (const sec of REQUIRED_SECTIONS) {
    const m = sec.pattern.exec(body);
    if (m && m.index !== undefined) {
      matches.push({ id: sec.id, index: m.index });
    }
  }

  matches.sort((a, b) => a.index - b.index);
  const result: Record<string, string> = {};

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    result[current.id] = body.slice(current.index, next ? next.index : body.length);
  }

  return result;
}

function countMarkdownTableDataRows(sectionText: string): { dataRows: number; hasEmptyCells: boolean } {
  const lines = sectionText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 3) return { dataRows: 0, hasEmptyCells: false };

  // Ignorar cabecera (línea 0) y separador | :--- | (línea 1)
  const dataLines = lines.slice(2);
  let hasEmptyCells = false;

  for (const row of dataLines) {
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.some((c) => c.length < 2)) {
      hasEmptyCells = true;
    }
  }

  return { dataRows: dataLines.length, hasEmptyCells };
}

export function auditSpecFile(filePath: string, requireApproved: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const rawContent = fs.readFileSync(filePath, 'utf-8');
  const isTemplate = path.basename(filePath).startsWith('_TEMPLATE');
  const { fm, body, error } = parseFrontmatter(rawContent);

  if (error) {
    issues.push({ ruleId: 'FM-001', severity: 'ERROR', section: 'Frontmatter', message: error });
    return issues;
  }

  // 1. Auditoría de Frontmatter
  if (!isTemplate && (!fm.id || !/^SDD-\d{3,}$/.test(String(fm.id)) || fm.id === 'SDD-000')) {
    issues.push({
      ruleId: 'FM-002',
      severity: 'ERROR',
      section: 'Frontmatter',
      message: `ID inválido o sin cambiar de la plantilla ("${fm.id}"). Formato requerido: SDD-001.`,
    });
  }

  const validTiers = ['L1-patch', 'L2-feature', 'L3-system'];
  if (!fm.tier || !validTiers.includes(fm.tier)) {
    issues.push({
      ruleId: 'FM-003',
      severity: 'ERROR',
      section: 'Frontmatter',
      message: `Campo "tier" inválido. Debe ser uno de: ${validTiers.join(', ')}.`,
    });
  }

  if (requireApproved && !isTemplate && fm.status !== 'APPROVED' && fm.status !== 'IMPLEMENTED') {
    issues.push({
      ruleId: 'FM-004',
      severity: 'ERROR',
      section: 'Frontmatter',
      message: `El spec tiene status "${fm.status}". Se requiere status "APPROVED" para autorizar el build.`,
    });
  }

  if (typeof fm.has_ui !== 'boolean' || typeof fm.has_db !== 'boolean') {
    issues.push({
      ruleId: 'FM-005',
      severity: 'ERROR',
      section: 'Frontmatter',
      message: 'Los flags declarativos "has_ui" y "has_db" deben ser booleanos explícitos (true/false).',
    });
  }

  if (!fm.max_latency_p95_ms || fm.max_latency_p95_ms <= 0) {
    issues.push({
      ruleId: 'FM-006',
      severity: 'ERROR',
      section: 'Frontmatter',
      message: 'Falta presupuesto SLO "max_latency_p95_ms" mayor a 0 en el frontmatter.',
    });
  }

  // 2. Detección Anti-Slop (Anti-Reward Hacking)
  const cleanBody = stripHtmlComments(body);
  if (!isTemplate) {
    for (const slop of BANNED_SLOP_PATTERNS) {
      if (slop.regex.test(cleanBody)) {
        issues.push({
          ruleId: 'SLOP-001',
          severity: 'ERROR',
          section: 'Global',
          message: `Detectado patrón prohibido de evasión documental: ${slop.label}.`,
        });
      }
    }
  }

  // 3. Existencia de los 6 Bloques Canónicos
  const sections = extractSections(cleanBody);
  for (const reqSec of REQUIRED_SECTIONS) {
    if (fm.tier === 'L1-patch' && fm.has_ui === false && (reqSec.id === 'SEC_3' || reqSec.id === 'SEC_4')) {
      continue;
    }
    if (!sections[reqSec.id]) {
      issues.push({
        ruleId: 'STRUCT-001',
        severity: 'ERROR',
        section: reqSec.name,
        message: `Falta el encabezado canónico obligatorio: "${reqSec.name}".`,
      });
    }
  }

  // 4. Auditoría Profunda por Sección
  // Sección 1: PRD
  if (sections.SEC_1) {
    const checkboxes = sections.SEC_1.match(/^-\s+\[\s*[xX ]?\s*\]\s+.+/gm) || [];
    if (checkboxes.length < 2) {
      issues.push({
        ruleId: 'PRD-001',
        severity: 'ERROR',
        section: '1. PRD',
        message: `Se requieren al menos 2 Criterios de Aceptación verificables con "- [ ]". Encontrados: ${checkboxes.length}.`,
      });
    }
    if (!/Non-Goals|L[ií]mites Estrictos/i.test(sections.SEC_1)) {
      issues.push({
        ruleId: 'PRD-002',
        severity: 'ERROR',
        section: '1. PRD',
        message: 'El PRD debe declarar explícitamente una subsección de "Non-Goals" para acotar al agente.',
      });
    }
  }

  // Sección 2: TRD & Matriz FMEA
  if (sections.SEC_2) {
    const { dataRows, hasEmptyCells } = countMarkdownTableDataRows(sections.SEC_2);
    const minRows = fm.tier === 'L1-patch' ? 1 : 3;
    if (dataRows < minRows) {
      issues.push({
        ruleId: 'TRD-001',
        severity: 'ERROR',
        section: '2. TRD & FMEA',
        message: `La Matriz de Modos de Fallo (FMEA) requiere una tabla Markdown con al menos ${minRows} vectores de fallo documentados. Filas actuales: ${dataRows}.`,
      });
    }
    if (hasEmptyCells) {
      issues.push({
        ruleId: 'TRD-002',
        severity: 'ERROR',
        section: '2. TRD & FMEA',
        message: 'La tabla FMEA contiene celdas vacías o incompletas.',
      });
    }
  }

  // Sección 3: Flow (Mermaid)
  if (sections.SEC_3) {
    const mermaidMatch = sections.SEC_3.match(/```mermaid\r?\n([\s\S]*?)```/);
    if (!mermaidMatch) {
      issues.push({
        ruleId: 'FLOW-001',
        severity: 'ERROR',
        section: '3. App / System Flow',
        message: 'Se requiere un bloque de código ```mermaid definiendo el flujo o máquina de estados.',
      });
    } else {
      const mermaidCode = mermaidMatch[1];
      const hasValidDiagramType = /\b(stateDiagram-v2|sequenceDiagram|flowchart)\b/.test(mermaidCode);
      const transitions = mermaidCode.match(/(-->|->>)/g) || [];
      const hasErrorPath = /\b(Error|Failed|Fault|Reject|Timeout|DLQ|Invalid)\b/i.test(mermaidCode);

      if (!hasValidDiagramType || transitions.length < 3) {
        issues.push({
          ruleId: 'FLOW-002',
          severity: 'ERROR',
          section: '3. App / System Flow',
          message: 'El diagrama Mermaid debe ser un stateDiagram-v2, sequenceDiagram o flowchart con al menos 3 transiciones reales.',
        });
      }
      if (!hasErrorPath) {
        issues.push({
          ruleId: 'FLOW-003',
          severity: 'ERROR',
          section: '3. App / System Flow',
          message: 'El diagrama Mermaid solo modela el "Happy Path". Debe incluir al menos un estado de error, timeout o rechazo.',
        });
      }
    }
  }

  // Sección 4: Design Brief
  if (sections.SEC_4 && fm.has_ui === true) {
    const requiredUiStates = ['Loading', 'Empty', 'Error', 'Success'];
    const missingStates = requiredUiStates.filter(
      (st) => !new RegExp(`\\b${st}\\b`, 'i').test(sections.SEC_4)
    );
    if (missingStates.length > 0) {
      issues.push({
        ruleId: 'UI-001',
        severity: 'ERROR',
        section: '4. Design Brief',
        message: `Con has_ui: true, el Design Brief debe definir explícitamente los 4 estados de vista. Faltan: ${missingStates.join(', ')}.`,
      });
    }
  }

  // Sección 5: Backend Schema & Zero-Trust
  if (sections.SEC_5) {
    const codeBlocks = [...sections.SEC_5.matchAll(/```(typescript|ts|sql|prisma|json)\r?\n([\s\S]*?)```/g)];
    if (codeBlocks.length === 0) {
      issues.push({
        ruleId: 'SCHEMA-001',
        severity: 'ERROR',
        section: '5. Backend Schema',
        message: 'La Sección 5 debe contener al menos un bloque de código tipado (```typescript, ```sql o ```prisma) con contratos reales.',
      });
    } else {
      const totalCodeChars = codeBlocks.reduce((acc, curr) => acc + curr[2].trim().length, 0);
      if (totalCodeChars < 60) {
        issues.push({
          ruleId: 'SCHEMA-002',
          severity: 'ERROR',
          section: '5. Backend Schema',
          message: `Los bloques de código en la Sección 5 son demasiado breves (${totalCodeChars} chars). Define esquemas Zod/SQL completos.`,
        });
      }
    }

    if (fm.has_db === true && !/\b(CREATE TABLE|ALTER TABLE|model\s+\w+|z\.object)\b/i.test(sections.SEC_5)) {
      issues.push({
        ruleId: 'SCHEMA-003',
        severity: 'ERROR',
        section: '5. Backend Schema',
        message: 'Con has_db: true, se requiere DDL SQL (CREATE/ALTER TABLE), modelo Prisma o esquema Zod explícito.',
      });
    }

    if (!/Zero-Trust|Multi-Tenant|tenant_id|Autenticaci[oó]n/i.test(sections.SEC_5)) {
      issues.push({
        ruleId: 'SEC-001',
        severity: 'ERROR',
        section: '5. Backend Schema',
        message: 'Falta documentar las invariantes de seguridad Zero-Trust / aislamiento de datos en la Sección 5.',
      });
    }
  }

  // Sección 6: Implementation Plan
  if (sections.SEC_6) {
    const phases = sections.SEC_6.match(/^###\s+Fase\s+\d+/gm) || [];
    const verifyCommands = sections.SEC_6.match(/\*\*Verify:\*\*\s*`[^`]+`/g) || [];

    if (phases.length === 0) {
      issues.push({
        ruleId: 'PLAN-001',
        severity: 'ERROR',
        section: '6. Implementation Plan',
        message: 'El Plan de Implementación debe dividirse en encabezados "### Fase 1: ...", "### Fase 2: ...".',
      });
    } else if (verifyCommands.length < phases.length) {
      issues.push({
        ruleId: 'PLAN-002',
        severity: 'ERROR',
        section: '6. Implementation Plan',
        message: `Hay ${phases.length} fases declaradas pero solo ${verifyCommands.length} directivas "**Verify:** \`comando\`". Cada fase exige verificación ejecutable.`,
      });
    }
  }

  return issues;
}

// Entrypoint CLI
function main() {
  const args = process.argv.slice(2);
  const requireApproved = args.includes('--require-approved');
  const targetArg = args.find((a) => !a.startsWith('--'));

  const specsDir = path.resolve(process.cwd(), 'docs/specs');
  let filesToAudit: string[] = [];

  if (targetArg) {
    filesToAudit = [path.resolve(process.cwd(), targetArg)];
  } else if (fs.existsSync(specsDir)) {
    // Si no se especifica archivo, audita todos los SDD-*.md (excluyendo _TEMPLATE)
    filesToAudit = fs
      .readdirSync(specsDir)
      .filter((f) => f.startsWith('SDD-') && f.endsWith('.md'))
      .map((f) => path.join(specsDir, f));
    
    // Si aún no hay specs SDD creadas, audita la plantilla para asegurar que compila
    if (filesToAudit.length === 0 && fs.existsSync(path.join(specsDir, '_TEMPLATE_SDD_6.md'))) {
      filesToAudit = [path.join(specsDir, '_TEMPLATE_SDD_6.md')];
    }
  }

  if (filesToAudit.length === 0) {
    console.log('ℹ️  [SDD-GUARD] No hay archivos SDD pendientes de auditar en docs/specs/.');
    process.exit(0);
  }

  console.log('============================================================');
  console.log('🛡️  SPEC-DRIVEN DEVELOPMENT (SDD-6) TOPOLOGY & QUALITY GUARD');
  console.log(`    Auditoría Polimórfica Anti-Slop (Require Approved: ${requireApproved})`);
  console.log('============================================================\n');

  let hasFailures = false;

  for (const file of filesToAudit) {
    const relPath = path.relative(process.cwd(), file);
    const issues = auditSpecFile(file, requireApproved);

    if (issues.length === 0) {
      console.log(`✅ PASS: ${relPath}`);
    } else {
      hasFailures = true;
      console.error(`\n❌ FAIL: ${relPath} (${issues.length} violaciones constitucionales detectadas)`);
      for (const issue of issues) {
        console.error(`   • [${issue.ruleId}] (${issue.section}): ${issue.message}`);
      }
    }
  }

  if (hasFailures) {
    console.error('\n🛑 DEPLOY O CODIFICACIÓN BLOQUEADA: Corrige las especificaciones antes de continuar.');
  } else {
    console.log('\n🚀 Todas las especificaciones cumplen el estándar SDD-6 de Grado Industrial.');
  }

  process.exit(hasFailures ? 1 : 0);
}

main();

