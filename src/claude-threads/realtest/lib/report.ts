/**
 * realtest — plain, dependency-free console reporting. Kept deliberately simple
 * so the output is greppable and copy-pasteable into a bug report.
 */
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

export function heading(text: string): void {
  console.log(`\n${C.bold}${C.cyan}▐ ${text}${C.reset}`);
}
export function pass(text: string): void {
  console.log(`  ${C.green}✓${C.reset} ${text}`);
}
export function fail(text: string): void {
  console.log(`  ${C.red}✗ ${text}${C.reset}`);
}
export function warn(text: string): void {
  console.log(`  ${C.yellow}⚠ ${text}${C.reset}`);
}
export function info(text: string): void {
  console.log(`  ${C.dim}${text}${C.reset}`);
}
export function kv(key: string, value: string): void {
  console.log(`  ${C.dim}${key.padEnd(16)}${C.reset}${value}`);
}
