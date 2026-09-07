import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
const outputRoot = fileURLToPath(new URL('../dist/', import.meta.url));
const staticExtensions = new Set(['.json', '.wxml', '.wxss', '.png', '.jpg', '.jpeg', '.webp', '.svg']);

await mkdir(outputRoot, { recursive: true });

async function copyStaticFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const sourcePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await copyStaticFiles(sourcePath);
      continue;
    }
    if (!staticExtensions.has(extname(entry.name))) continue;
    const destinationPath = join(outputRoot, relative(sourceRoot, sourcePath));
    await mkdir(dirname(destinationPath), { recursive: true });
    await cp(sourcePath, destinationPath);
  }
}

await copyStaticFiles(sourceRoot);
await rewriteClientCoreImports(outputRoot);

async function rewriteClientCoreImports(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await rewriteClientCoreImports(filePath);
      continue;
    }
    if (extname(entry.name) !== '.js') continue;
    const source = await readFile(filePath, 'utf8');
    if (!source.includes('@lets-eat/client-core')) continue;
    const importPath = relative(dirname(filePath), join(outputRoot, 'vendor', 'client-core', 'index.js'))
      .split(sep)
      .join('/');
    const localImportPath = importPath.startsWith('.') ? importPath : `./${importPath}`;
    const rewritten = source.replaceAll('require("@lets-eat/client-core")', `require("${localImportPath}")`);
    await writeFile(filePath, rewritten);
  }
}
