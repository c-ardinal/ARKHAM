import { describe, it, expect } from 'vitest';
import { getLibrariesWithLicenses } from './libraryList';

describe('getLibrariesWithLicenses', () => {
  it('returns name + license pairs for all dependencies, sorted by name', () => {
    const deps = {
      react: '^19.0.0',
      zustand: '^5.0.0',
      clsx: '^2.0.0',
    };
    const licenseMap = {
      react: 'MIT',
      zustand: 'MIT',
      clsx: 'MIT',
    };
    expect(getLibrariesWithLicenses(deps, licenseMap)).toEqual([
      { name: 'clsx', license: 'MIT' },
      { name: 'react', license: 'MIT' },
      { name: 'zustand', license: 'MIT' },
    ]);
  });

  it('returns empty array for empty deps', () => {
    expect(getLibrariesWithLicenses({}, {})).toEqual([]);
  });

  it('returns empty array for undefined deps', () => {
    expect(getLibrariesWithLicenses(undefined, {})).toEqual([]);
  });

  it('falls back to "UNKNOWN" when license is missing in the map', () => {
    const deps = { 'mysterious-pkg': '^1.0.0', react: '^19.0.0' };
    const licenseMap = { react: 'MIT' };
    expect(getLibrariesWithLicenses(deps, licenseMap)).toEqual([
      { name: 'mysterious-pkg', license: 'UNKNOWN' },
      { name: 'react', license: 'MIT' },
    ]);
  });

  it('does not include version values in any field', () => {
    const deps = { 'react-dom': '^19.2.3' };
    const licenseMap = { 'react-dom': 'MIT' };
    const result = getLibrariesWithLicenses(deps, licenseMap);
    const flat = result.flatMap((r) => [r.name, r.license]);
    expect(flat.some((s) => s.includes('^'))).toBe(false);
    expect(flat.some((s) => /\d+\.\d+\.\d+/.test(s))).toBe(false);
  });

  it('returns stable lexicographic order regardless of input order', () => {
    const licenseMap = { a: 'MIT', b: 'MIT', c: 'MIT' };
    const r1 = getLibrariesWithLicenses({ b: '1', a: '1', c: '1' }, licenseMap);
    const r2 = getLibrariesWithLicenses({ c: '1', a: '1', b: '1' }, licenseMap);
    expect(r1).toEqual(r2);
    expect(r1.map((x) => x.name)).toEqual(['a', 'b', 'c']);
  });

  it('handles scoped npm package names', () => {
    const deps = {
      '@types/react': '1',
      react: '1',
      '@vitejs/plugin-react': '1',
    };
    const licenseMap = {
      '@types/react': 'MIT',
      react: 'MIT',
      '@vitejs/plugin-react': 'MIT',
    };
    expect(getLibrariesWithLicenses(deps, licenseMap).map((x) => x.name)).toEqual([
      '@types/react',
      '@vitejs/plugin-react',
      'react',
    ]);
  });

  it('preserves the license string verbatim (e.g. SPDX expressions)', () => {
    const deps = { 'dual-licensed-pkg': '1' };
    const licenseMap = { 'dual-licensed-pkg': '(MIT OR Apache-2.0)' };
    expect(getLibrariesWithLicenses(deps, licenseMap)).toEqual([
      { name: 'dual-licensed-pkg', license: '(MIT OR Apache-2.0)' },
    ]);
  });
});
