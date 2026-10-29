import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function temporaryDir() {
  const dir = mkdtempSync(join(tmpdir(), 'rig-reader-'));
  dirs.push(dir);
  return dir;
}
function writeNight(dir: string, text: string) {
  writeFileSync(join(dir, '2026-10-28.jsonl'), text);
}

describe('readNight', () => {
  it('reads the real fixture without modifying it', () => {
    const result = readNight('runs', '2026-10-28');
    expect(result.found).toBe(true);
    if (!result.found) throw new Error('missing fixture');
    expect(result.rows.map(row => row.job)).toEqual(['digest/render', 'fixtures/refresh', 'lane/sync', 'notes/backup', 'rig/rotate-logs']);
    expect(result.badLines).toBe(1);
    expect(result.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(result.rows[0].owner).toBeNull();
    expect(result.rows[1]).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
  });

  it('aggregates in file order and retains the last supplied error and owner', () => {
    const dir = temporaryDir();
    writeNight(dir, [
      { at: 'later+02:00', job: 'z', status: 'fail', owner: 'one', error: 'first' },
      { at: 'x', job: 'A', status: 'ok', owner: null },
      { at: 'earlier-03:00', job: 'z', status: 'retry', owner: null, error: '' },
      { at: 'last+01:00', job: 'z', status: 'ok', owner: null },
    ].map(entry => JSON.stringify(entry)).join('\n'));
    expect(readNight(dir, '2026-10-28')).toEqual({ found: true, badLines: 0, counts: { ok: 2, retry: 1, fail: 1 }, rows: [
      { job: 'A', owner: null, runs: 1, retries: 0, lastStatus: 'ok', lastError: null, firstTime: 'x', lastTime: 'x' },
      { job: 'z', owner: null, runs: 3, retries: 1, lastStatus: 'ok', lastError: '', firstTime: 'later+02:00', lastTime: 'last+01:00' },
    ] });
  });

  it('counts malformed and schema-invalid lines and continues', () => {
    const dir = temporaryDir();
    const valid = { at: 'time', job: 'job', status: 'ok', owner: null };
    writeNight(dir, ['{', '', 'null', '[]', JSON.stringify({ ...valid, at: 1 }),
      JSON.stringify({ ...valid, job: null }), JSON.stringify({ ...valid, status: 'other' }),
      JSON.stringify({ at: 'time', job: 'job', status: 'ok' }),
      JSON.stringify({ ...valid, owner: 3 }), JSON.stringify({ ...valid, error: null }),
      JSON.stringify(valid), ''].join('\n'));
    expect(readNight(dir, '2026-10-28')).toMatchObject({ found: true, badLines: 10, counts: { ok: 1, retry: 0, fail: 0 } });
  });

  it('distinguishes empty, blank, and missing files', () => {
    const dir = temporaryDir();
    expect(readNight(dir, '2026-10-28')).toEqual({ found: false });
    writeNight(dir, '');
    expect(readNight(dir, '2026-10-28')).toEqual({ found: true, rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
    writeNight(dir, '\n\n');
    expect(readNight(dir, '2026-10-28')).toMatchObject({ found: true, badLines: 2 });
  });

  it('rejects invalid names before reading and only checks the filename pattern', () => {
    const dir = temporaryDir();
    for (const night of ['../2026-10-28', '2026-1-28', '2026-10-28\n', '2026-10-28.jsonl', '']) {
      expect(() => readNight(dir, night)).toThrow(RangeError);
    }
    expect(readNight(dir, '9999-99-99')).toEqual({ found: false });
  });

  it('propagates I/O errors other than ENOENT', () => {
    const dir = temporaryDir();
    mkdirSync(join(dir, '2026-10-28.jsonl'));
    expect(() => readNight(dir, '2026-10-28')).toThrow();
  });
});
