/** Canonical workspaces keep guest navigation separate from operational routes. */
const paths: Record<string, string> = {
  "/dashboard": "", "/historical": "/trends", "/alerts": "/alerts",
  "/devices": "/devices", "/remote-monitoring": "/sites",
  "/ai-decision": "/assistant", "/thresholds": "/rules",
  "/data-source": "/connection", "/admin": "/access",
  "/activity-log": "/events", "/notifications": "/notifications",
  "/about": "/about",
};

export function workspacePath(target: string, pathname: string): string {
  const suffixIndex = target.search(/[?#]/);
  const path = suffixIndex < 0 ? target : target.slice(0, suffixIndex);
  const suffix = suffixIndex < 0 ? "" : target.slice(suffixIndex);
  if (!(path in paths)) return target;
  return `${pathname === "/live" || pathname.startsWith("/live/") ? "/live" : "/demo"}${paths[path]}${suffix}`;
}
