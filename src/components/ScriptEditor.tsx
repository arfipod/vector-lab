import { useMemo, useRef } from 'react';
import type { ChangeEvent, UIEvent } from 'react';
import { scriptActions, scriptOptionPaths, scriptPresetNames, splitScriptLineComment } from '../lib/scripting';

interface Props {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

interface Token {
  text: string;
  className?: string;
}

const commandWords = new Set<string>(['preset', 'set', 'run']);
const booleanWords = new Set<string>(['true', 'false', 'yes', 'no', 'on', 'off']);
const actionWords = new Set<string>(scriptActions);
const presetWords = new Set<string>(scriptPresetNames);
const pathWords = new Set(scriptOptionPaths.map((path) => path.toLowerCase()));
const editorPathPattern = /^editor\.[\w.-]+$/i;
const tokenPattern = /(["'](?:\\.|(?!\1)[^\\])*["']|#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?|[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+(?:\.\*)?|[A-Za-z][\w-]*|[-+]?(?:\d+\.?\d*|\.\d+)|[=:])/g;

function isValidScriptLine(line: string): boolean {
  const code = splitScriptLineComment(line).code.trim();
  return !code || /^preset\s+[\w-]+$/i.test(code) || /^run\s+[\w-]+$/i.test(code) || /^set\s+[\w.-]+(?:\s*(?:=|:)\s*|\s+).+$/i.test(code);
}

function classifyToken(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (text === '=' || text === ':') return 'script-token-operator';
  if (/^["']/.test(text) || /^#[0-9a-fA-F]/.test(text)) return 'script-token-value';
  if (/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(text)) return 'script-token-number';
  if (booleanWords.has(lower)) return 'script-token-boolean';
  if (commandWords.has(lower)) return 'script-token-command';
  if (actionWords.has(lower) || presetWords.has(lower)) return 'script-token-value';
  if (pathWords.has(lower) || editorPathPattern.test(text) || /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+(?:\.\*)?$/.test(text)) return 'script-token-path';
  return undefined;
}

function tokenizeCode(code: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of code.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) tokens.push({ text: code.slice(cursor, index) });
    tokens.push({ text: match[0], className: classifyToken(match[0]) });
    cursor = index + match[0].length;
  }

  if (cursor < code.length) tokens.push({ text: code.slice(cursor) });
  return tokens;
}

function tokenizeLine(line: string): Token[] {
  const { code, comment } = splitScriptLineComment(line);
  if (!comment) return tokenizeCode(code);
  return [
    ...tokenizeCode(code),
    { text: comment, className: 'script-token-comment' }
  ];
}

export function ScriptEditor({ value, onChange, ariaLabel }: Props) {
  const highlightRef = useRef<HTMLPreElement | null>(null);
  const lines = useMemo(() => value.replace(/\r\n?/g, '\n').split('\n'), [value]);

  const syncScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const highlight = highlightRef.current;
    if (!highlight) return;
    highlight.scrollTop = event.currentTarget.scrollTop;
    highlight.scrollLeft = event.currentTarget.scrollLeft;
  };

  return <div className="script-editor">
    <pre className="script-highlight" aria-hidden="true" ref={highlightRef}>
      <code>
        {lines.map((line, lineIndex) => {
          const invalid = !isValidScriptLine(line);
          return <span className={`script-line${invalid ? ' script-token-error' : ''}`} key={lineIndex}>
            {tokenizeLine(line).map((token, tokenIndex) => token.className
              ? <span className={token.className} key={tokenIndex}>{token.text}</span>
              : <span key={tokenIndex}>{token.text}</span>)}
            {lineIndex < lines.length - 1 ? '\n' : null}
          </span>;
        })}
      </code>
    </pre>
    <textarea
      aria-label={ariaLabel}
      spellCheck={false}
      wrap="off"
      value={value}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      onScroll={syncScroll}
    />
  </div>;
}
