/**
 * Derives the base path from the current page URL.
 * In standalone mode: "" (empty string, routes resolve to root)
 * Behind HA ingress: "/api/hassio_ingress/<token>" (routes resolve through ingress proxy)
 */
export function getBasePath(): string {
  return window.location.pathname.replace(/\/$/, '');
}

/**
 * Build a WebSocket URL relative to the current page location.
 * Handles both standalone (ws://) and ingress (wss://) modes.
 */
export function getWsUrl(path: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${getBasePath()}/${path}`;
}
