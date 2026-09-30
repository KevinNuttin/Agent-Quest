/**
 * Origin allow-list shared by CORS, state-changing routes and the WebSocket
 * upgrade.
 *
 * CORS alone is not enough: WebSocket upgrades are not subject to CORS, and
 * a "simple" cross-site POST (no custom headers) is sent without preflight.
 * Any page open in the user's browser could otherwise read the live feed
 * (prompts, replies, commands) or hit the hook installer.
 *
 * Requests with no Origin header are not coming from a browser page (curl,
 * Claude Code's `http` hook) and are allowed: the loopback bind is what keeps
 * the network out.
 */

export interface AllowedOriginsOptions {
  clientUrl: string;
  clientPort: number;
  lanEnabled: boolean;
  lanAddresses: readonly string[];
}

/** Normalize to `scheme://host:port` so comparisons ignore trailing slashes. */
function normalize(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function buildAllowedOrigins(opts: AllowedOriginsOptions): Set<string> {
  const hosts = ['localhost', '127.0.0.1', '[::1]'];
  if (opts.lanEnabled) hosts.push(...opts.lanAddresses);

  const origins = new Set<string>();
  for (const host of hosts) origins.add(`http://${host}:${opts.clientPort}`);

  const client = normalize(opts.clientUrl);
  if (client !== null) origins.add(client);
  return origins;
}

/** True when the request may proceed: no Origin (non-browser) or an allowed one. */
export function isOriginAllowed(origin: string | null | undefined, allowed: ReadonlySet<string>): boolean {
  if (origin === null || origin === undefined || origin === '') return true;
  const normalized = normalize(origin);
  return normalized !== null && allowed.has(normalized);
}

/** Loopback unless the user explicitly opted into LAN exposure. */
export function resolveBindHostname(lanEnabled: boolean): string {
  return lanEnabled ? '0.0.0.0' : '127.0.0.1';
}
