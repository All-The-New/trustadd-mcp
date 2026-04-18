// null = unversioned at URL level (e.g. /api/mpp/...); versioned groups support TRUSTADD_API_VERSION_OVERRIDE
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
