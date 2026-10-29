import type { DigestRow, StatusCounts } from '../digest/types.js';

export function DigestPage(props: {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: StatusCounts;
}) {
  return (
    <>
      <h1>digest / {props.night}</h1>
      <p>
        ok {props.counts.ok} / retry {props.counts.retry} / fail {props.counts.fail}
      </p>
      {props.badLines > 0 && (
        <p class="warn">malformed lines: {props.badLines}</p>
      )}
      {props.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th>
              <th>last status</th><th>last error</th><th>first time</th><th>last time</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => {
              const warn = row.retries >= 3 || row.lastStatus === 'fail';
              return (
                <tr>
                  <td>{row.job}</td>
                  <td>{row.owner ?? '\u2014'}</td>
                  <td>{row.runs}</td>
                  <td class={row.retries >= 3 ? 'warn' : undefined}>{row.retries}</td>
                  <td class={warn ? 'warn' : undefined}>{row.lastStatus}</td>
                  <td>{row.lastError ?? '\u2014'}</td>
                  <td>{row.firstTime}</td>
                  <td>{row.lastTime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
