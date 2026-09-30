import { describe, test, expect } from 'bun:test';
import { buildAllowedOrigins, isOriginAllowed, resolveBindHostname } from './origin-guard';

const base = {
  clientUrl: 'http://localhost:4445',
  clientPort: 4445,
  lanEnabled: false,
  lanAddresses: ['192.168.1.20'],
};

describe('buildAllowedOrigins', () => {
  test('allows loopback client origins only by default', () => {
    const allowed = buildAllowedOrigins(base);
    expect(allowed.has('http://localhost:4445')).toBe(true);
    expect(allowed.has('http://127.0.0.1:4445')).toBe(true);
    expect(allowed.has('http://192.168.1.20:4445')).toBe(false);
  });

  test('adds LAN addresses only when LAN mode is enabled', () => {
    const allowed = buildAllowedOrigins({ ...base, lanEnabled: true });
    expect(allowed.has('http://192.168.1.20:4445')).toBe(true);
  });

  test('normalizes a CLIENT_URL with a trailing slash', () => {
    const allowed = buildAllowedOrigins({ ...base, clientUrl: 'http://example.test:9000/' });
    expect(allowed.has('http://example.test:9000')).toBe(true);
  });
});

describe('isOriginAllowed', () => {
  const allowed = buildAllowedOrigins(base);

  test('accepts requests without Origin (curl, Claude Code http hook)', () => {
    expect(isOriginAllowed(null, allowed)).toBe(true);
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
    expect(isOriginAllowed('', allowed)).toBe(true);
  });

  test('accepts the dashboard origin', () => {
    expect(isOriginAllowed('http://localhost:4445', allowed)).toBe(true);
  });

  test('rejects third-party pages', () => {
    expect(isOriginAllowed('https://evil.example', allowed)).toBe(false);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(false);
    expect(isOriginAllowed('null', allowed)).toBe(false);
  });
});

describe('resolveBindHostname', () => {
  test('binds loopback by default and all interfaces in LAN mode', () => {
    expect(resolveBindHostname(false)).toBe('127.0.0.1');
    expect(resolveBindHostname(true)).toBe('0.0.0.0');
  });
});
