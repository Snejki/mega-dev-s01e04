import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = (runsDir: string) => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const directories: string[] = [];

function fixture(files: Record<string, string>) {
  const runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  directories.push(runsDir);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(runsDir, name), contents, 'utf8');
  }
  return runsDir;
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('digest routes', () => {
  it('serves the same sorted rows in HTML and JSON, preserving details', async () => {
    const runsDir = fixture({
      '2026-10-28.jsonl': [
        JSON.stringify({ at: '2026-10-28T09:00:00-04:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T09:15:00-04:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T09:30:00-04:00', job: 'zeta', status: 'retry', owner: null }),
        JSON.stringify({ at: '2026-10-28T09:45:00-04:00', job: 'zeta', status: 'fail', owner: null, error: 'timeout' }),
        JSON.stringify({ at: '2026-10-28T10:00:00+02:00', job: 'alpha', status: 'ok', owner: 'Ada' }),
        '{bad json',
      ].join('\n') + '\n',
    });
    const app = createApp(config(runsDir));

    const jsonResponse = await app.request('/api/digest/2026-10-28');
    expect(jsonResponse.status).toBe(200);
    const payload = await jsonResponse.json();
    expect(payload).toMatchObject({
      found: true,
      badLines: 1,
      counts: { ok: 1, retry: 3, fail: 1 },
      rows: [
        { job: 'alpha', owner: 'Ada', runs: 1, retries: 0, lastStatus: 'ok', firstTime: '2026-10-28T10:00:00+02:00', lastTime: '2026-10-28T10:00:00+02:00' },
        { job: 'zeta', owner: null, runs: 4, retries: 3, lastStatus: 'fail', lastError: 'timeout', firstTime: '2026-10-28T09:00:00-04:00', lastTime: '2026-10-28T09:45:00-04:00' },
      ],
    });

    const htmlResponse = await app.request('/digest/2026-10-28');
    expect(htmlResponse.status).toBe(200);
    const html = await htmlResponse.text();
    const alpha = html.indexOf('alpha');
    const zeta = html.indexOf('zeta');
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(zeta).toBeGreaterThan(alpha);
    expect(html).toContain('—');
    expect(html).toContain('2026-10-28T09:00:00-04:00');
    expect(html).toContain('2026-10-28T09:45:00-04:00');
    expect(html).toContain('2026-10-28T10:00:00+02:00');
    expect(html.toLowerCase()).toMatch(/retry|fail/);
    expect(html).toContain('timeout');
  });

  it('returns 404 for absent files in both formats', async () => {
    const app = createApp(config(fixture({})));
    expect((await app.request('/digest/2026-10-27')).status).toBe(404);
    expect((await app.request('/api/digest/2026-10-27')).status).toBe(404);
  });

  it('renders an empty night and returns empty JSON rows', async () => {
    const app = createApp(config(fixture({ '2026-10-28.jsonl': '' })));
    const html = await app.request('/digest/2026-10-28');
    expect(html.status).toBe(200);
    expect(await html.text()).toContain('nothing ran');
    const json = await app.request('/api/digest/2026-10-28');
    expect(json.status).toBe(200);
    expect(await json.json()).toMatchObject({ found: true, rows: [], badLines: 0 });
  });

  it('returns 404 for invalid and traversal-like night values', async () => {
    const runsDir = fixture({});
    mkdirSync(join(runsDir, '2026-10-28.jsonl'), { recursive: true });
    const app = createApp(config(runsDir));
    for (const path of ['/digest/not-a-date', '/api/digest/not-a-date', '/digest/../../secret', '/api/digest/../../secret']) {
      expect((await app.request(path)).status).toBe(404);
    }
  });
});
