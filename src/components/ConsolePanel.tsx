import { useMemo, useState } from 'react';
import type { LogEntry } from '../types';
import { scriptHelp } from '../lib/scripting';
interface Props { logs: LogEntry[]; onClear: () => void; onRunScript: (script: string) => void; }
export function ConsolePanel({ logs, onClear, onRunScript }: Props) {
  const [open, setOpen] = useState(true); const [script, setScript] = useState(scriptHelp);
  const logText = useMemo(() => logs.map((l) => `[${new Date(l.time).toLocaleTimeString()}] ${l.level.toUpperCase()} ${l.message}${l.data ? ` ${JSON.stringify(l.data)}` : ''}`).join('\n'), [logs]);
  return <section className={`console-panel ${open ? 'open' : 'closed'}`}>
    <div className="console-toolbar"><button type="button" onClick={() => setOpen((v) => !v)}>{open ? 'Hide console' : 'Show console'}</button><button type="button" onClick={() => navigator.clipboard?.writeText(logText)}>Copy log</button><button type="button" onClick={onClear}>Clear</button></div>
    {open ? <div className="console-grid"><div className="log-stream">{logs.map((l) => <div key={l.id} className={`log-line ${l.level}`}><span>{new Date(l.time).toLocaleTimeString()}</span><strong>{l.level}</strong><p>{l.message}</p></div>)}</div><div className="script-box"><div className="script-header"><strong>Script</strong><button className="primary" type="button" onClick={() => onRunScript(script)}>Run script</button></div><textarea spellCheck={false} value={script} onChange={(e) => setScript(e.target.value)} /></div></div> : null}
  </section>;
}
