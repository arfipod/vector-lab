import { type FocusEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { helpRecipes, optionHelp, optionHelpById, type OptionHelp } from '../content/optionHelp';

interface HelpButtonProps {
  optionId: string;
}

interface HelpGuideProps {
  open: boolean;
  onClose: () => void;
}

function OptionHelpContent({ item, compact = false }: { item: OptionHelp; compact?: boolean }) {
  return <div className={compact ? 'help-content compact' : 'help-content'}>
    <strong>{item.label}</strong>
    <p>{item.explanation}</p>
    {!compact ? <>
      <dl>
        <div><dt>Technical effect</dt><dd>{item.technicalEffect}</dd></div>
        <div><dt>Default</dt><dd>{item.defaultValue}</dd></div>
        <div><dt>Valid values</dt><dd>{item.validValues}</dd></div>
        <div><dt>Recommended</dt><dd>{item.recommendedValues}</dd></div>
      </dl>
      {item.warnings.length ? <div className="help-warning"><span>Watch for</span><ul>{item.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null}
    </> : <small>{item.defaultValue}</small>}
  </div>;
}

export function HelpButton({ optionId }: HelpButtonProps) {
  const item = optionHelpById[optionId];
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement | null>(null);
  const visible = open || pinned;

  useEffect(() => {
    if (!pinned) return;
    const close = (): void => {
      setPinned(false);
      setOpen(false);
    };
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current?.contains(event.target as Node)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pinned]);

  if (!item) return null;

  const closeIfLeaving = (event: FocusEvent<HTMLSpanElement>): void => {
    const next = event.relatedTarget;
    if (!pinned && (!(next instanceof Node) || !event.currentTarget.contains(next))) setOpen(false);
  };

  return <span ref={rootRef} className={`help-tip ${visible ? 'open' : ''}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) setOpen(false); }} onBlur={closeIfLeaving}>
    <button
      type="button"
      className="help-trigger"
      aria-label={`Help: ${item.label}`}
      aria-expanded={visible}
      aria-describedby={visible ? tooltipId : undefined}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setPinned((value) => {
          const next = !value;
          setOpen(next);
          return next;
        });
      }}
      onFocus={() => setOpen(true)}
    >
      ?
    </button>
    <span id={tooltipId} className="help-popover" role="tooltip">
      <OptionHelpContent item={item} compact />
    </span>
  </span>;
}

export function HelpLabel({ optionId, children }: { optionId: string; children: ReactNode }) {
  return <span className="label-with-help"><span>{children}</span><HelpButton optionId={optionId} /></span>;
}

export function SectionHeading({ optionId, title, meta }: { optionId: string; title: string; meta?: ReactNode }) {
  return <h2><span className="section-title-text">{title}<HelpButton optionId={optionId} /></span>{meta ? <span className="section-title-meta">{meta}</span> : null}</h2>;
}

export function HelpGuide({ open, onClose }: HelpGuideProps) {
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return optionHelp;
    return optionHelp.filter((item) => [
      item.label,
      item.path,
      item.section,
      item.group,
      item.explanation,
      item.technicalEffect,
      item.defaultValue,
      item.validValues,
      item.recommendedValues,
      ...item.warnings
    ].join(' ').toLowerCase().includes(needle));
  }, [query]);
  const grouped = useMemo(() => {
    const groups = new Map<string, OptionHelp[]>();
    visible.forEach((item) => {
      const key = `${item.section === 'editing' ? 'Editing' : 'Vectorization'}: ${item.group}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    });
    return Array.from(groups.entries());
  }, [visible]);

  if (!open) return null;

  return <div className="help-guide-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="help-guide" role="dialog" aria-modal="true" aria-labelledby="help-guide-title">
      <header className="help-guide-header">
        <div>
          <h2 id="help-guide-title">Help Guide</h2>
          <p>Search every Editing and Vectorization option, including defaults, ranges, recommendations, and tradeoffs.</p>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </header>
      <label className="sr-only" htmlFor="help-search">Search help</label>
      <input id="help-search" type="search" value={query} placeholder="Search options, settings, or problems" autoFocus onChange={(event) => setQuery(event.target.value)} />
      <div className="help-guide-body">
        <section className="help-recipes" aria-labelledby="help-recipes-title">
          <h3 id="help-recipes-title">Best Settings For...</h3>
          <div className="recipe-grid">
            {helpRecipes.map((recipe) => <article className="recipe-card" key={recipe.title}>
              <h4>{recipe.title}</h4>
              <p>{recipe.goal}</p>
              <ul>{recipe.settings.map((setting) => <li key={setting}>{setting}</li>)}</ul>
              <small>{recipe.watchFor}</small>
            </article>)}
          </div>
        </section>
        <section aria-label="Option reference">
          {grouped.map(([group, items]) => <div className="help-option-group" key={group}>
            <h3>{group}</h3>
            <div className="help-option-list">
              {items.map((item) => <article className="help-option-card" key={item.id}>
                <OptionHelpContent item={item} />
                <code>{item.path}</code>
              </article>)}
            </div>
          </div>)}
          {!visible.length ? <p className="help-empty">No options match that search.</p> : null}
        </section>
      </div>
    </section>
  </div>;
}
