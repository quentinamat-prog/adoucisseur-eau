/**
 * Run once after cloning/duplicating the repo:
 *   node scripts/init.mjs
 *
 * Updates package.json name from site.config.mjs automatically.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { default: siteConfig } = await import('../site.config.mjs');

// Update package.json name
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const slug = siteConfig.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
pkg.name = slug;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✓ package.json name → "${slug}"`);

console.log('\n✅ Init terminé. Tu peux maintenant lancer : npm run dev');
