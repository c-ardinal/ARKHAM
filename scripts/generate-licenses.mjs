// Generates src/generated/licenses.json from each dependency's
// node_modules/<pkg>/package.json `license` field.
// Run automatically via the `prebuild` npm script.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const pkgJsonPath = path.join(projectRoot, 'package.json');
const outputPath = path.join(projectRoot, 'src', 'generated', 'licenses.json');

const extractLicense = (depPkg) => {
  if (typeof depPkg.license === 'string') return depPkg.license;
  if (depPkg.license && typeof depPkg.license === 'object' && depPkg.license.type) {
    return depPkg.license.type;
  }
  if (Array.isArray(depPkg.licenses) && depPkg.licenses[0]?.type) {
    return depPkg.licenses[0].type;
  }
  return 'UNKNOWN';
};

const main = () => {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const deps = pkg.dependencies ?? {};
  const names = Object.keys(deps).sort();

  const licenses = {};
  let unknownCount = 0;
  for (const name of names) {
    const depPkgPath = path.join(projectRoot, 'node_modules', name, 'package.json');
    try {
      const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
      const license = extractLicense(depPkg);
      licenses[name] = license;
      if (license === 'UNKNOWN') unknownCount += 1;
    } catch (err) {
      console.warn(`[generate-licenses] Failed to read ${name}: ${err.message}`);
      licenses[name] = 'UNKNOWN';
      unknownCount += 1;
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2) + '\n', 'utf8');

  const rel = path.relative(projectRoot, outputPath).replace(/\\/g, '/');
  console.log(`[generate-licenses] Wrote ${names.length} entries to ${rel}`);
  if (unknownCount > 0) {
    console.warn(`[generate-licenses] ${unknownCount} package(s) resolved to UNKNOWN`);
  }
};

main();
