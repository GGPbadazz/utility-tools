import { useState, useRef, useEffect } from 'react';
import type { ProjectModel, DisplayMode } from '../domain/types';
import { getLabel } from '../domain/labels';

type Props = {
  project: ProjectModel;
  displayMode: DisplayMode;
  onLocateNode: (nodeId: string) => void;
  onClose: () => void;
};

type SearchResult = {
  id: string;
  label: string;
  type: 'unit' | 'connection' | 'annotation';
  targetNodeId?: string;
};

export default function SearchBar({ project, displayMode, onLocateNode, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const results: SearchResult[] = [];
  const q = query.toLowerCase().trim();

  if (q) {
    // Search units
    for (const [id, unit] of Object.entries(project.units)) {
      const label = getLabel(unit.label, id, displayMode);
      if (id.toLowerCase().includes(q) || label.toLowerCase().includes(q) || (unit.customType || '').toLowerCase().includes(q)) {
        results.push({ id, label: `${label} (${unit.type})`, type: 'unit', targetNodeId: id });
      }

      if (unit.ports) {
        for (const [portId, port] of Object.entries(unit.ports)) {
          const uid = typeof port.uid === 'string' ? port.uid.toLowerCase() : '';
          if (uid && uid.includes(q)) {
            results.push({
              id: `${id}::${portId}`,
              label: `${label} - 端口 ${portId} [UID:${uid}]`,
              type: 'unit',
              targetNodeId: id,
            });
          }
        }
      }
    }
    // Search connections
    for (const conn of project.connections) {
      const label = getLabel(conn.label, conn.id, displayMode);
      if (conn.id.toLowerCase().includes(q) || label.toLowerCase().includes(q) || conn.from.toLowerCase().includes(q) || conn.to.toLowerCase().includes(q)) {
        results.push({
          id: conn.id,
          label: `${label} [${conn.from} → ${conn.to}]`,
          type: 'connection',
          targetNodeId: `conn:${conn.id}`,
        });
      }
    }
    // Search annotations
    for (const ann of project.annotations || []) {
      const text = getLabel(ann.text, ann.id, displayMode);
      if (ann.id.toLowerCase().includes(q) || text.toLowerCase().includes(q)) {
        results.push({ id: `ann-${ann.id}`, label: text, type: 'annotation' });
      }
    }
  }

  const handleSelect = (result: SearchResult) => {
    onLocateNode(result.targetNodeId || result.id);
    onClose();
  };

  return (
    <div className="search-bar">
      <span style={{ fontSize: 14 }}>🔍</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索设备/连接 ID 或名称..."
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results.length > 0) {
            handleSelect(results[0]);
          }
        }}
      />
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#999' }}
      >
        ✕
      </button>
      {q && results.length > 0 && (
        <div className="search-results">
          {results.slice(0, 10).map((r) => (
            <div key={r.id} className="search-result-item" onClick={() => handleSelect(r)}>
              <span className="result-id">{r.id}</span>
              <span className="result-label">{r.label}</span>
            </div>
          ))}
        </div>
      )}
      {q && results.length === 0 && (
        <div className="search-results">
          <div className="search-result-item" style={{ color: '#999', cursor: 'default' }}>
            无匹配结果/No results
          </div>
        </div>
      )}
    </div>
  );
}
