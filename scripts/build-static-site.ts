#!/usr/bin/env bun

import { existsSync } from 'fs';
import { cp, lstat, mkdir, rm, symlink, unlink } from 'fs/promises';
import { relative, resolve } from 'path';

const workspaceRoot = resolve(import.meta.dir, '..');
const appsRoot = resolve(workspaceRoot, 'apps');
const webRoot = resolve(appsRoot, 'web');
const tempRoot = resolve(appsRoot, 'web-static-export');
const tempNodeModules = resolve(tempRoot, 'node_modules');
const outputRoot = resolve(webRoot, 'out');

async function copyIfExists(path: string) {
  const source = resolve(webRoot, path);
  if (!existsSync(source)) return;

  await cp(source, resolve(tempRoot, path), { recursive: true });
}

async function removeTempRoot() {
  if (existsSync(tempNodeModules)) {
    const stats = await lstat(tempNodeModules);
    if (stats.isSymbolicLink()) await unlink(tempNodeModules);
  }

  await rm(tempRoot, { recursive: true, force: true });
}

await removeTempRoot();
await rm(outputRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
await symlink(resolve(webRoot, 'node_modules'), tempNodeModules, process.platform === 'win32' ? 'junction' : 'dir');

await Promise.all([
  copyIfExists('next-env.d.ts'),
  copyIfExists('next.config.ts'),
  copyIfExists('package.json'),
  copyIfExists('postcss.config.mjs'),
  copyIfExists('public'),
  copyIfExists('tsconfig.json'),
]);

await cp(resolve(webRoot, 'src'), resolve(tempRoot, 'src'), {
  recursive: true,
  filter: source => {
    const rel = relative(resolve(webRoot, 'src'), source).replaceAll('\\', '/');
    return rel !== 'app/api' && !rel.startsWith('app/api/');
  },
});

try {
  const nextCli = resolve(webRoot, 'node_modules/next/dist/bin/next');
  if (!existsSync(nextCli)) throw new Error('Missing Next.js dependency. Run bun install first.');

  const proc = Bun.spawn({
    cmd: [process.execPath, nextCli, 'build'],
    cwd: tempRoot,
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_STATIC_EXPORT: 'true',
    },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) process.exit(exitCode);

  await cp(resolve(tempRoot, 'out'), outputRoot, { recursive: true });
} finally {
  await removeTempRoot();
}