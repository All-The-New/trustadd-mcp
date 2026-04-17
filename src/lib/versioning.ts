/**
 * API version registry.
 *
 * Maps API group → URL version segment. `null` means the group is currently
 * unversioned at the URL level (e.g. /api/mpp/...). Versioned groups support
 * override via TRUSTADD_API_VERSION_OVERRIDE env var (for testing v2 before
 * its default promotion).
 *
 * When adding a v2 endpoint:
 *   1. Bump the map entry: `trust: 'v2'`
 *   2. Add a CHANGELOG entry describing the upgrade
 *   3. Bump the package minor version
 */
export const API_VERSIONS = {
  trust: "v1",
  mpp: null,
  analytics: null,
  status: null,
} as const;

export type ApiGroup = keyof typeof API_VERSIONS;

const GROUP_PREFIX: Record<ApiGroup, string> = {
  trust: "/api/__v__/trust",
  mpp: "/api/mpp",
  analytics: "/api/analytics",
  status: "/api",
};

/** Build a full API path for a group + subpath. */
export function apiPath(group: ApiGroup, subpath: string): string {
  const version = API_VERSIONS[group];
  const override = process.env.TRUSTADD_API_VERSION_OVERRIDE;
  const effectiveVersion = version !== null ? (override || version) : null;

  const prefix = GROUP_PREFIX[group];
  const resolved = effectiveVersion
    ? prefix.replace("__v__", effectiveVersion)
    : prefix;

  return `${resolved}${subpath}`;
}
