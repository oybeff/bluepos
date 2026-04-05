/**
 * Lightweight replacement for @workspace/api-client-react
 * Only exports the two functions used by the mobile app.
 */

export type AuthTokenGetter = () => Promise<string | null> | string | null;

let _baseUrl: string | null = null;
let _authTokenGetter: AuthTokenGetter | null = null;

export function setBaseUrl(url: string | null): void {
  _baseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function setAuthTokenGetter(getter: AuthTokenGetter | null): void {
  _authTokenGetter = getter;
}

export function getBaseUrl(): string | null {
  return _baseUrl;
}

export function getAuthTokenGetter(): AuthTokenGetter | null {
  return _authTokenGetter;
}
