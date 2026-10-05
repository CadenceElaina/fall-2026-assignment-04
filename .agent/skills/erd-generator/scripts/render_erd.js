#!/usr/bin/env node
// Validates a Mermaid ERD and compiles it to SVG with the project's mermaid-cli (mmdc).
//
// Usage (from the repo root):
//   node .agent/skills/erd-generator/scripts/render_erd.js docs/architecture/schema.mmd
//
// Success: writes docs/architecture/erd.svg, prints SUCCESS, exits 0.
// Failure: prints SYNTAX_ERROR: <mmdc stderr>, exits 1.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

// .agent/skills/erd-generator/scripts -> repo root
const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..', '..');

// Resolve the input against the current directory first, then the repo root,
// so the script works whether the agent runs it from the repo root or the skill folder.
const inputArg = process.argv[2] ?? 'docs/architecture/schema.mmd';
const input = [path.resolve(inputArg), path.resolve(repoRoot, inputArg)].find((p) => existsSync(p)) ?? path.resolve(inputArg);
const output = path.resolve(process.argv[3] ?? path.join(repoRoot, 'docs', 'architecture', 'erd.svg'));

if (!existsSync(input)) {
  console.error(`ERROR: input file not found: ${input}`);
  process.exit(1);
}

// Remove any stale SVG so a failed compile can never leave an old diagram looking current.
mkdirSync(path.dirname(output), { recursive: true });
rmSync(output, { force: true });

// Prefer the locally installed binary; fall back to npx.
const localBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc');
const [cmd, baseArgs] = existsSync(localBin) ? [localBin, []] : ['npx', ['--no-install', 'mmdc']];

// Headless Chrome cannot use its sandbox in some Linux and CI environments.
const puppeteerConfig = path.join(import.meta.dirname, 'puppeteer-config.json');

const result = spawnSync(
  cmd,
  [...baseArgs, '-i', input, '-o', output, '-p', puppeteerConfig, '-q'],
  { cwd: repoRoot, encoding: 'utf8', shell: process.platform === 'win32' },
);

const produced = existsSync(output) && statSync(output).size > 0;

if (result.error || result.status !== 0 || !produced) {
  const trace = [result.error?.message, result.stderr, result.stdout]
    .filter((s) => s && s.trim())
    .join('\n')
    .trim();
  rmSync(output, { force: true });
  console.error(`SYNTAX_ERROR: ${trace || `mmdc exited with status ${result.status} and produced no SVG`}`);
  process.exit(1);
}

console.log('SUCCESS');
console.log(`SVG written to ${path.relative(repoRoot, output)}`);
process.exit(0);
