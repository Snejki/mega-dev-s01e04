/** A status on one valid log entry, not a summary of a job. */
export type RunStatus = 'ok' | 'retry' | 'fail';

/** One job's valid entries, accumulated in file order. */
export type DigestRow = {
  job: string;
  /** Owner on the last entry; null is a real missing value. */
  owner: string | null;
  /** Number of valid entries for this job, including retries and failures. */
  runs: number;
  /** Number of this job's entries with status `retry`. */
  retries: number;
  lastStatus: RunStatus;
  /** Most recent supplied error, or null if no entry supplied one. */
  lastError: string | null;
  /** First and last entry timestamps in file order, unchanged including offsets. */
  firstTime: string;
  lastTime: string;
};

/** Counts of valid log entries by status, not counts of jobs' last statuses. */
export type StatusCounts = Record<RunStatus, number>;

/**
 * A missing file is distinct from an empty file. For a found file, rows are
 * sorted by job in ascending string order; badLines counts malformed JSON or
 * entries that do not match the log schema. Blank lines count as bad, except
 * the empty segment after a final newline. An empty file has zero bad lines.
 */
export type ReadNightResult =
  | { found: false }
  | { found: true; rows: DigestRow[]; badLines: number; counts: StatusCounts };

/**
 * Synchronous reader signature: readNight(runsDir, night).
 * `night` must match YYYY-MM-DD (the same filename pattern as nightsOnDisk);
 * reject any other value with RangeError before constructing a path. This is
 * a filename check, not calendar-date validation. Read only
 * runsDir/<night>.jsonl; ENOENT returns { found: false }, while other I/O
 * errors propagate. No implementation is provided by this contract.
 */
export type ReadNight = (runsDir: string, night: string) => ReadNightResult;
