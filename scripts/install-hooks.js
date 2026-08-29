import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const src = join(process.cwd(), 'scripts', 'githooks', 'pre-commit');
const dest = join(process.cwd(), '.git', 'hooks', 'pre-commit');

if (!existsSync(src)) {
  console.log('No githooks/pre-commit found, skipping');
  process.exit(0);
}

try {
  const destDir = join(process.cwd(), '.git', 'hooks');
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log('✓ Installed pre-commit hook');
} catch (e) {
  console.warn('Failed to install hook:', e.message);
}
