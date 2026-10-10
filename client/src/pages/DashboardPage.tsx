import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { Diagram, DiagramStats } from '../api/types';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import NewDiagramModal, { type NewDiagramChoice } from '../components/library/NewDiagramModal';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { pendingImport } from '../lib/draft';
import { TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType } from '../lib/diagram/types';
import { timeAgo } from '../lib/format';

/** What the sidebar is showing: everything, starred diagrams, or one diagram type. */
type View = 'all' | 'starred' | DiagramType;

const TYPES = Object.keys(TYPE_INFO) as DiagramType[];

const VIEW_TITLES: Record<View, string> = {
  all: 'All diagrams',
  starred: 'Starred',
  flowchart: 'Flowcharts',
  mindmap: 'Mind maps',
  orgchart: 'Org charts',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState('updated');
  const q = useDebouncedValue(search.trim(), 250);

  const list = useAsync(
    (signal) =>
      diagramsApi.list(
        { q, sort, type: view === 'all' || view === 'starred' ? 'all' : view, starred: view === 'starred' ? 'true' : undefined },
        signal
      ),
    [q, view, sort]
  );
  const stats = useAsync((signal) => diagramsApi.stats(signal), []);

  // A guest who clicked "Sign up to save" in the playground lands here: import their work.
  const importedRef = useRef(false);
  useEffect(() => {
    if (importedRef.current) return;
    importedRef.current = true;
    const draft = pendingImport.take();
    if (!draft) return;
    diagramsApi
      .create(draft)
      .then((diagram) => {
        toast('Your playground diagram was saved', 'success');
        navigate(`/d/${diagram._id}`);
      })
      .catch((err: Error) => toast(`Could not import your draft: ${err.message}`, 'error'));
  }, [navigate, toast]);

  async function create(choice: NewDiagramChoice) {
    try {
      const diagram = await diagramsApi.create(choice);
      navigate(`/d/${diagram._id}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const replace = (updated: Diagram) =>
    list.setData((items) => items?.map((d) => (d._id === updated._id ? { ...d, ...updated } : d)));

  async function toggleStar(diagram: Diagram) {
    replace({ ...diagram, starred: !diagram.starred });
    try {
      await diagramsApi.update(diagram._id, { starred: !diagram.starred });
      if (view === 'starred') list.setData((items) => items?.filter((d) => d._id !== diagram._id || !diagram.starred));
    } catch (err) {
      replace(diagram);
      toast((err as Error).message, 'error');
    }
  }

  async function duplicate(diagram: Diagram) {
    try {
      await diagramsApi.duplicate(diagram._id);
      toast('Duplicated', 'success');
      list.reload();
      stats.reload();
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  async function remove(diagram: Diagram) {
    if (!window.confirm(`Delete "${diagram.title}"? This cannot be undone.`)) return;
    try {
      await diagramsApi.remove(diagram._id);
      list.setData((items) => items?.filter((d) => d._id !== diagram._id));
      stats.reload();
      toast('Deleted');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  }

  const isFiltered = Boolean(q) || view !== 'all';
  const count = list.data?.length;

  return (
    <div className="library">
      <Sidebar view={view} onChange={setView} stats={stats.data} />

      <section className="library-main">
        <header className="library-toolbar">
          <div className="library-heading">
            <h1>{VIEW_TITLES[view]}</h1>
            {count !== undefined && (
              <p className="muted small">
                {count} {count === 1 ? 'diagram' : 'diagrams'}
              </p>
            )}
          </div>
          <input
            type="search"
            className="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search diagrams"
          />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
            <option value="updated">Recently edited</option>
            <option value="created">Newest</option>
            <option value="title">Title A–Z</option>
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New diagram
          </button>
        </header>

        <div className="library-content">
          {list.loading && !list.data && <Spinner />}
          {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

          {list.data?.length === 0 &&
            (isFiltered ? (
              <EmptyState title="Nothing here">
                <p className="muted">{q ? 'No diagram titles match your search.' : 'Diagrams you add here will show up in this list.'}</p>
              </EmptyState>
            ) : (
              <EmptyState title="No diagrams yet">
                <p className="muted">Describe one or pick a template to get started.</p>
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                  New diagram
                </button>
              </EmptyState>
            ))}

          {list.data && list.data.length > 0 && (
            <div className="diagram-grid">
              {list.data.map((d) => (
                <DiagramCard key={d._id} diagram={d} onStar={toggleStar} onDuplicate={duplicate} onDelete={remove} />
              ))}
            </div>
          )}
        </div>
      </section>

      {creating && <NewDiagramModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}

/** Finder-style source list: library views on top, diagram types below. */
function Sidebar({ view, onChange, stats }: { view: View; onChange: (view: View) => void; stats?: DiagramStats }) {
  const item = (value: View, count?: number) => (
    <li key={value}>
      <button className={`sidebar-item${view === value ? ' active' : ''}`} aria-current={view === value} onClick={() => onChange(value)}>
        <span>{VIEW_TITLES[value]}</span>
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
      <ul>{TYPES.map((t) => item(t, stats?.byType[t]))}</ul>
      {stats && stats.shared > 0 && (
        <p className="sidebar-note muted small">
          {stats.shared} shared, {stats.views} {stats.views === 1 ? 'view' : 'views'}
        </p>
      )}
    </aside>
  );
}

interface CardProps {
  diagram: Diagram;
  onStar: (d: Diagram) => void;
  onDuplicate: (d: Diagram) => void;
  onDelete: (d: Diagram) => void;
}

function DiagramCard({ diagram: d, onStar, onDuplicate, onDelete }: CardProps) {
  return (
    <article className="diagram-card">
      <Link to={`/d/${d._id}`} className="diagram-card-preview" aria-label={`Open ${d.title}`}>
        <DiagramThumbnail type={d.type} source={d.source} theme={d.theme} direction={d.direction} />
      </Link>
      <div className="diagram-card-body">
        <div className="diagram-card-title">
          <Link to={`/d/${d._id}`}>
            <h3>{d.title}</h3>
          </Link>
          <button className={`star${d.starred ? ' on' : ''}`} onClick={() => onStar(d)} aria-pressed={d.starred}>
            {d.starred ? 'Starred' : 'Star'}
          </button>
        </div>
        <div className="diagram-card-meta">
          <span>{TYPE_INFO[d.type].label}</span>
          <span>Edited {timeAgo(d.updatedAt)}</span>
          {d.isPublic && <span className="shared-flag">Shared</span>}
        </div>
        <div className="diagram-card-actions">
          <button className="link-btn" onClick={() => onDuplicate(d)}>
            Duplicate
          </button>
          <button className="link-btn danger" onClick={() => onDelete(d)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}
