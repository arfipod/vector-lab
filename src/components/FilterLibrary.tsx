import { useEffect, useMemo, useRef, useState } from 'react';
import type { LogLevel, VectorOptions } from '../types';
import { defaultVectorOptions, presetMetadata, presets } from '../defaults';
import { downloadText } from '../lib/download';
import { cloneOptions, isVectorOptions, mergeVectorOptions } from '../lib/options';

interface FilterLibraryProps {
  options: VectorOptions;
  appliedFilterId: string | null;
  appliedFilterModified: boolean;
  onApply: (id: string, name: string, options: Partial<VectorOptions>) => void;
  onMessage?: (level: LogLevel, message: string) => void;
}

interface CustomFilter {
  id: string;
  name: string;
  description: string;
  options: VectorOptions;
  createdAt: number;
  updatedAt: number;
}

interface FilterItem {
  id: string;
  source: 'built-in' | 'custom';
  name: string;
  description: string;
  categories: string[];
  tags: string[];
  recommendedUse: string;
  options: Partial<VectorOptions>;
  custom?: CustomFilter;
}

const storageKey = 'vector-lab.custom-filters.v1';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const makeId = (): string => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const cleanName = (name: string): string => name.trim().slice(0, 80);
const cleanDescription = (description: string): string => description.trim().slice(0, 240);
const fileName = (name: string): string => `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'filter'}.json`;

function loadCustomFilters(): CustomFilter[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const filter = parseCustomFilter(item, false);
      return filter ? [filter] : [];
    });
  } catch {
    return [];
  }
}

function parseCustomFilter(value: unknown, requireName = true): CustomFilter | null {
  if (!isRecord(value)) return null;
  const options = value.options;
  if (!isVectorOptions(options)) return null;
  const name = typeof value.name === 'string' ? cleanName(value.name) : '';
  if (requireName && !name) return null;
  const now = Date.now();
  return {
    id: typeof value.id === 'string' && value.id ? value.id : makeId(),
    name: name || 'Imported filter',
    description: typeof value.description === 'string' ? cleanDescription(value.description) : '',
    options: cloneOptions(options),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now
  };
}

function parseImportedFilters(text: string): CustomFilter[] {
  const parsed = JSON.parse(text) as unknown;
  const rawFilters = isRecord(parsed) && Array.isArray(parsed.filters)
    ? parsed.filters
    : Array.isArray(parsed)
      ? parsed
      : [parsed];
  const filters = rawFilters.map((item) => parseCustomFilter(item)).filter((item): item is CustomFilter => item !== null);
  if (!filters.length) throw new Error('No valid filters found in JSON.');
  return filters;
}

function exportFilters(filters: CustomFilter[], filename = 'vector-lab-filters.json'): void {
  const payload = {
    version: 1,
    filters: filters.map((filter) => ({
      id: filter.id,
      name: filter.name,
      description: filter.description,
      options: filter.options,
      createdAt: filter.createdAt,
      updatedAt: filter.updatedAt
    }))
  };
  downloadText(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
}

function modeLabel(mode: VectorOptions['mode']): string {
  if (mode === 'layered') return 'Layered';
  if (mode === 'color') return 'Color';
  return 'Binary';
}

function summaryOptions(options: Partial<VectorOptions>): VectorOptions {
  return mergeVectorOptions(defaultVectorOptions, options);
}

function FilterSummary({ options }: { options: Partial<VectorOptions> }) {
  const full = summaryOptions(options);
  const chips = [
    `Mode ${modeLabel(full.mode)}`,
    `Max ${full.maxSide}px`,
    full.mode !== 'binary' ? `${full.color.colors} colors` : null,
    full.mode !== 'color' ? `${full.binary.thresholdMode} threshold` : null,
    `Simplify ${full.trace.simplify}`,
    `Blur ${full.blur}px`
  ].filter((item): item is string => item !== null);
  return <div className="filter-summary">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>;
}

export function FilterLibrary({ options, appliedFilterId, appliedFilterModified, onApply, onMessage }: FilterLibraryProps) {
  const [customFilters, setCustomFilters] = useState<CustomFilter[]>(loadCustomFilters);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [feedback, setFeedback] = useState('');
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(customFilters));
  }, [customFilters]);

  const builtInFilters = useMemo<FilterItem[]>(() => Object.entries(presets).map(([key, preset]) => {
    const metadata = presetMetadata[key as keyof typeof presetMetadata];
    return {
      id: `built-in:${key}`,
      source: 'built-in',
      name: metadata.name,
      description: metadata.description,
      categories: metadata.categories,
      tags: metadata.tags,
      recommendedUse: metadata.recommendedUse,
      options: preset
    };
  }), []);

  const customItems = useMemo<FilterItem[]>(() => customFilters.map((filter) => ({
    id: `custom:${filter.id}`,
    source: 'custom',
    name: filter.name,
    description: filter.description,
    categories: ['Custom'],
    tags: ['custom', filter.options.mode],
    recommendedUse: 'Saved from the current vectorization controls.',
    options: filter.options,
    custom: filter
  })), [customFilters]);

  const items = useMemo(() => [...builtInFilters, ...customItems], [builtInFilters, customItems]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(items.flatMap((item) => item.categories))).sort()], [items]);
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'All' && !item.categories.includes(category)) return false;
      if (!needle) return true;
      const full = summaryOptions(item.options);
      const haystack = [
        item.id,
        item.name,
        item.description,
        item.recommendedUse,
        full.mode,
        modeLabel(full.mode),
        ...item.categories,
        ...item.tags
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [category, items, query]);

  const postMessage = (level: LogLevel, message: string): void => {
    setFeedback(message);
    onMessage?.(level, message);
  };

  const saveCurrentFilter = (): void => {
    const name = cleanName(newName);
    if (!name) {
      postMessage('warn', 'Name the filter before saving it.');
      return;
    }
    const now = Date.now();
    setCustomFilters((current) => [{
      id: makeId(),
      name,
      description: cleanDescription(newDescription),
      options: cloneOptions(options),
      createdAt: now,
      updatedAt: now
    }, ...current]);
    setNewName('');
    setNewDescription('');
    setSaving(false);
    postMessage('info', `Saved custom filter: ${name}.`);
  };

  const startRename = (filter: CustomFilter): void => {
    setEditingId(filter.id);
    setEditName(filter.name);
    setEditDescription(filter.description);
  };

  const saveRename = (): void => {
    if (!editingId) return;
    const name = cleanName(editName);
    if (!name) {
      postMessage('warn', 'Custom filters need a name.');
      return;
    }
    setCustomFilters((current) => current.map((filter) => filter.id === editingId
      ? { ...filter, name, description: cleanDescription(editDescription), updatedAt: Date.now() }
      : filter));
    setEditingId(null);
    postMessage('info', `Renamed custom filter: ${name}.`);
  };

  const deleteCustomFilter = (filter: CustomFilter): void => {
    if (!window.confirm(`Delete "${filter.name}"?`)) return;
    setCustomFilters((current) => current.filter((item) => item.id !== filter.id));
    postMessage('info', `Deleted custom filter: ${filter.name}.`);
  };

  const importFilters = async (file: File): Promise<void> => {
    try {
      const incoming = parseImportedFilters(await file.text());
      setCustomFilters((current) => {
        const used = new Set(current.map((filter) => filter.id));
        const unique = incoming.map((filter) => {
          if (!used.has(filter.id)) {
            used.add(filter.id);
            return filter;
          }
          const id = makeId();
          used.add(id);
          return { ...filter, id };
        });
        return [...unique, ...current];
      });
      postMessage('info', `Imported ${incoming.length} custom filter${incoming.length === 1 ? '' : 's'}.`);
    } catch (error) {
      postMessage('error', `Filter import failed: ${(error as Error).message}`);
    }
  };

  return <section className="section filter-library">
    <h2>2. Filter Library <span>{visibleItems.length}/{items.length}</span></h2>
    <div className="filter-tools">
      <label className="sr-only" htmlFor="filter-search">Search filters</label>
      <input id="filter-search" type="search" value={query} placeholder="Search filters" onChange={(event) => setQuery(event.target.value)} />
      <div className="filter-chip-row" aria-label="Filter categories">
        {categories.map((item) => <button key={item} type="button" className={`filter-chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </div>

    <div className="filter-actions">
      <button type="button" onClick={() => setSaving((value) => !value)}>Save current settings as filter</button>
      <button type="button" disabled={!customFilters.length} onClick={() => exportFilters(customFilters)}>Export custom filters</button>
      <button type="button" onClick={() => importInput.current?.click()}>Import JSON</button>
      <input ref={importInput} hidden type="file" accept="application/json,.json" onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void importFilters(file);
      }} />
    </div>

    {saving ? <div className="filter-form">
      <input type="text" value={newName} maxLength={80} placeholder="Filter name" onChange={(event) => setNewName(event.target.value)} />
      <textarea value={newDescription} maxLength={240} placeholder="Description" rows={3} onChange={(event) => setNewDescription(event.target.value)} />
      <div className="filter-form-actions">
        <button type="button" className="primary" onClick={saveCurrentFilter}>Save filter</button>
        <button type="button" onClick={() => setSaving(false)}>Cancel</button>
      </div>
    </div> : null}

    {feedback ? <p className="filter-feedback">{feedback}</p> : null}

    <div className="filter-list">
      {visibleItems.map((item) => {
        const exact = appliedFilterId === item.id && !appliedFilterModified;
        const modified = appliedFilterId === item.id && appliedFilterModified;
        const custom = item.custom;
        return <article key={item.id} className={`filter-item ${exact ? 'active' : ''} ${modified ? 'modified' : ''}`}>
          <div className="filter-item-top">
            <div>
              <strong>{item.name}</strong>
              <small>{item.source === 'built-in' ? 'Built-in' : 'Custom'}{exact ? ' · Applied' : modified ? ' · Modified' : ''}</small>
            </div>
            <button type="button" className={exact ? '' : 'primary'} disabled={exact} onClick={() => onApply(item.id, item.name, item.options)}>{exact ? 'Applied' : modified ? 'Reapply' : 'Apply'}</button>
          </div>
          <p>{item.description}</p>
          <FilterSummary options={item.options} />
          <div className="filter-tags">{item.categories.concat(item.tags).map((tag) => <span key={tag}>{tag}</span>)}</div>
          <small className="filter-use">{item.recommendedUse}</small>
          {custom ? editingId === custom.id ? <div className="filter-form compact">
            <input type="text" value={editName} maxLength={80} onChange={(event) => setEditName(event.target.value)} />
            <textarea value={editDescription} maxLength={240} rows={3} onChange={(event) => setEditDescription(event.target.value)} />
            <div className="filter-form-actions">
              <button type="button" className="primary" onClick={saveRename}>Save</button>
              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </div> : <div className="filter-custom-actions">
            <button type="button" onClick={() => startRename(custom)}>Rename</button>
            <button type="button" onClick={() => exportFilters([custom], fileName(custom.name))}>Export</button>
            <button type="button" className="danger" onClick={() => deleteCustomFilter(custom)}>Delete</button>
          </div> : null}
        </article>;
      })}
      {!visibleItems.length ? <p className="filter-empty">No filters match the current search.</p> : null}
    </div>
  </section>;
}
