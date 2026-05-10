import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogEntry } from '../types';
import { scriptHelp } from '../lib/scripting';
interface Props { logs: LogEntry[]; onClear: () => void; onRunScript: (script: string) => void; }
export function ConsolePanel({ logs, onClear, onRunScript }: Props) {
  const [open, setOpen] = useState(true); const [script, setScript] = useState(scriptHelp);
  const [copyState, setCopyState] = useState<'idle' | 'log' | 'script' | 'failed'>('idle');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logStreamRef = useRef<HTMLDivElement | null>(null);
  const logText = useMemo(() => logs.map((l) => `[${new Date(l.time).toLocaleTimeString()}] ${l.level.toUpperCase()} ${l.message}${l.data ? ` ${JSON.stringify(l.data)}` : ''}`).join('\n'), [logs]);

  useEffect(() => {
    if (!open || !autoScrollLogs) return;
    const logStream = logStreamRef.current;
    if (logStream) logStream.scrollTop = logStream.scrollHeight;
  }, [autoScrollLogs, logs, open]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timeout = window.setTimeout(() => setCopyState('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyText = async (text: string, type: 'log' | 'script') => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!copied) throw new Error('Clipboard copy failed');
      }
      setCopyState(type);
    } catch {
      setCopyState('failed');
    }
  };

  return <section className={`console-panel ${open ? 'open' : 'closed'}`}>
    <div className="console-toolbar">
      {open ? <label className="console-toggle"><input type="checkbox" checked={autoScrollLogs} onChange={(e) => setAutoScrollLogs(e.target.checked)} /> Auto-scroll logs</label> : null}
      <button type="button" onClick={() => setOpen((v) => !v)}>{open ? 'Hide console' : 'Show console'}</button>
      {open ? <button type="button" onClick={() => void copyText(logText, 'log')}>{copyState === 'log' ? 'Copied log' : 'Copy log'}</button> : null}
      {open ? <button type="button" onClick={onClear}>Clear console</button> : null}
    </div>
    {open ? <div className="console-grid">
      <div className="log-stream" ref={logStreamRef} aria-label="Console log stream">{logs.map((l) => <div key={l.id} className={`log-line ${l.level}`}><span>{new Date(l.time).toLocaleTimeString()}</span><strong>{l.level}</strong><p>{l.message}</p></div>)}</div>
      <div className="script-box">
        <div className="script-header"><strong>Script</strong><div className="script-actions"><button type="button" onClick={() => void copyText(script, 'script')}>{copyState === 'script' ? 'Copied script' : 'Copy script'}</button><button className="primary" type="button" onClick={() => onRunScript(script)}>Run script</button></div></div>
        <textarea spellCheck={false} value={script} onChange={(e) => setScript(e.target.value)} />
      </div>
      {copyState === 'failed' ? <p className="console-feedback" role="status">Copy failed. Clipboard access is unavailable in this browser.</p> : null}
    </div> : null}
  </section>;
}
