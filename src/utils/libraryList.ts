export interface LibraryInfo {
  name: string;
  license: string;
}

export const getLibrariesWithLicenses = (
  deps: Record<string, string> | undefined,
  licenseMap: Record<string, string>,
): LibraryInfo[] => {
  if (!deps) return [];
  return Object.keys(deps)
    .sort()
    .map((name) => ({
      name,
      license: licenseMap[name] ?? 'UNKNOWN',
    }));
};
