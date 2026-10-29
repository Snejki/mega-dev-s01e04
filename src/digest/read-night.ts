import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, ReadNight, RunStatus } from './types.js';

type Entry = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.at === 'string' && typeof entry.job === 'string' &&
    (entry.status === 'ok' || entry.status === 'retry' || entry.status === 'fail') &&
    (typeof entry.owner === 'string' || entry.owner === null) &&
    (!('error' in entry) || typeof entry.error === 'string');
}

export const readNight: ReadNight = (runsDir, night) => {
  if (typeof night !== 'string' || night.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(night)) throw new RangeError('Invalid night');

  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { found: false };
    throw error;
  }

  const rows = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;
  const lines = text === '' ? [] : text.split('\n');
  if (text.endsWith('\n')) lines.pop();

  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      badLines++;
      continue;
    }
    if (!isEntry(value)) {
      badLines++;
      continue;
    }
    counts[value.status]++;
    const row = rows.get(value.job);
    if (row) {
      row.owner = value.owner;
      row.runs++;
      if (value.status === 'retry') row.retries++;
      row.lastStatus = value.status;
      if (value.error !== undefined) row.lastError = value.error;
      row.lastTime = value.at;
    } else {
      rows.set(value.job, {
        job: value.job, owner: value.owner, runs: 1,
        retries: value.status === 'retry' ? 1 : 0,
        lastStatus: value.status, lastError: value.error ?? null,
        firstTime: value.at, lastTime: value.at,
      });
    }
  }

  return { found: true, rows: [...rows.values()].sort((a, b) => a.job < b.job ? -1 : a.job > b.job ? 1 : 0), badLines, counts };
};
