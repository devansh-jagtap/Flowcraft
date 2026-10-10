import type { DiagramStats } from '../../api/types';
import { TYPE_INFO } from '../../lib/diagram/templates';
import type { DiagramType } from '../../lib/diagram/types';

/** What the library is showing: everything, starred diagrams, or one diagram type. */
export type View = 'all' | 'starred' | DiagramType;

const TYPES = Object.keys(TYPE_INFO) as DiagramType[];

// eslint-disable-next-line react-refresh/only-export-components
export function viewTitle(view: View) {
  if (view === 'all') return 'All diagrams';
  if (view === 'starred') return 'Starred';
  return `${TYPE_INFO[view].label}s`;
}

interface Props {
  view: View;
  onChange: (view: View) => void;
  stats?: DiagramStats;
}

/** Finder-style source list: library views on top, diagram types below. */
export default function LibrarySidebar({ view, onChange, stats }: Props) {
  const item = (value: View, count?: number) => (
    <li key={value}>
      <button className={`sidebar-item${view === value ? ' active' : ''}`} aria-current={view === value} onClick={() => onChange(value)}>
        <span>{viewTitle(value)}</span>
        {count !== undefined && <span className="sidebar-count">{count}</span>}
      </button>
    </li>
  );

  return (
    <aside className="library-sidebar" aria-label="Library">
      <p className="sidebar-heading">Library</p>
      <ul>
        {item('all', stats?.diagrams)}
        {item('starred')}
      </ul>
      <p className="sidebar-heading">Types</p>
      <ul>{TYPES.map((t) => item(t, stats?.byType[t] ?? 0))}</ul>
      {stats && stats.shared > 0 && (
        <p className="sidebar-note muted small">
          {stats.shared} shared, {stats.views} {stats.views === 1 ? 'view' : 'views'}
        </p>
      )}
    </aside>
  );
}
