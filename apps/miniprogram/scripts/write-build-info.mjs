import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
const outputPath = fileURLToPath(new URL('../dist/config/build-info.js', import.meta.url));

export function formatBuildLabel(version, buildTime) {
  if (!(buildTime instanceof Date) || Number.isNaN(buildTime.getTime())) {
    throw new Error('构建时间无效');
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(buildTime).map(({ type, value }) => [type, value]),
  );
  return `v${version} · 构建于 ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function createBuildInfoModule(buildLabel) {
  return [
    '"use strict";',
    'Object.defineProperty(exports, "__esModule", { value: true });',
    'exports.BUILD_LABEL = void 0;',
    `exports.BUILD_LABEL = ${JSON.stringify(buildLabel)};`,
    '',
  ].join('\n');
}

export async function writeBuildInfo() {
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const configuredBuildTime = process.env.LETS_EAT_BUILD_TIME;
  const buildTime = configuredBuildTime ? new Date(configuredBuildTime) : new Date();
  const buildLabel = formatBuildLabel(packageJson.version, buildTime);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, createBuildInfoModule(buildLabel), 'utf8');
  console.info(`[miniprogram] ${buildLabel} (${resolve(packageRoot, 'dist')})`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await writeBuildInfo();
}
