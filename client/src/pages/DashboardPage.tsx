import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { Diagram } from '../api/types';
import { DiagramThumbnail } from '../components/diagram/DiagramThumbnail';
import NewDiagramModal, { type NewDiagramChoice } from '../components/NewDiagramModal';
import { EmptyState, ErrorState, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { pendingImport } from '../lib/draft';
import { TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType } from '../lib/diagram/types';
import { timeAgo } from '../lib/format';

const FILTERS: { value: 'all' | DiagramType; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(Object.keys(TYPE_INFO) as DiagramType[]).map((t) => ({ value: t, label: `${TYPE_INFO[t].icon} ${TYPE_INFO[t].label}` })),
];

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | DiagramType>('all');
  const [sort, setSort] = useState('updated');
  const q = useDebouncedValue(search.trim(), 250);

  const list = useAsync((signal) => diagramsApi.list({ q, type, sort }, signal), [q, type, sort]);
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
        toast('Your playground diagram was saved 🎉', 'success');
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

  const isFiltered = Boolean(q) || type !== 'all';

  return (
    <div className="container page">
      <div className="page-header">
        <div>
          <h1>Hi {user?.name.split(' ')[0]} 👋</h1>
          <p className="muted">What are we drawing today?</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          ＋ New diagram
        </button>
      </div>

      {stats.data && (
        <div className="stats">
          <div className="stat">
            <strong>{stats.data.diagrams}</strong>
            <span>Diagrams</span>
          </div>
          {(Object.keys(TYPE_INFO) as DiagramType[]).map((t) => (
            <div className="stat" key={t}>
              <strong>{stats.data!.byType[t]}</strong>
              <span>
                {TYPE_INFO[t].icon} {TYPE_INFO[t].label}s
              </span>
            </div>
          ))}
          <div className="stat">
            <strong>{stats.data.views}</strong>
            <span>Views on shared links</span>
          </div>
        </div>
      )}

      <div className="filters">
        <input
          type="search"
          className="search"
          placeholder="Search diagrams…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search diagrams"
        />
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.value} className={`chip${type === f.value ? ' active' : ''}`} onClick={() => setType(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by">
          <option value="updated">Recently edited</option>
          <option value="created">Newest</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {list.loading && !list.data && <Spinner />}
      {list.error && <ErrorState error={list.error} onRetry={list.reload} />}

      {list.data?.length === 0 &&
        (isFiltered ? (
          <EmptyState icon="🔍" title="No diagrams match">
            <p className="muted">Try a different search or filter.</p>
          </EmptyState>
        ) : (
          <EmptyState icon="🎨" title="Your canvas is empty">
            <p className="muted">Pick a template and have your first diagram in under a minute.</p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              Create a diagram
            </button>
          </EmptyState>
        ))}

      {list.data && list.data.length > 0 && (
        <div className="diagram-grid">
          {list.data.map((d) => (
            <article key={d._id} className="diagram-card">
              <Link to={`/d/${d._id}`} className="diagram-card-preview" aria-label={`Open ${d.title}`}>
                <DiagramThumbnail type={d.type} source={d.source} theme={d.theme} direction={d.direction} />
              </Link>
              <div className="diagram-card-body">
                <div className="diagram-card-title">
                  <Link to={`/d/${d._id}`}>
                    <h3>{d.title}</h3>
                  </Link>
                  <button
                    className={`star${d.starred ? ' on' : ''}`}
                    onClick={() => toggleStar(d)}
                    aria-pressed={d.starred}
                    aria-label={d.starred ? 'Unstar' : 'Star'}
                  >
                    {d.starred ? '★' : '☆'}
                  </button>
                </div>
                <div className="diagram-card-meta">
                  <span className="badge">
                    {TYPE_INFO[d.type].icon} {TYPE_INFO[d.type].label}
                  </span>
                  {d.isPublic && <span className="badge badge-green">🔗 Shared</span>}
                  <span className="muted small">Edited {timeAgo(d.updatedAt)}</span>
                </div>
                <div className="diagram-card-actions">
                  <button className="link-btn" onClick={() => duplicate(d)}>
                    Duplicate
                  </button>
                  <button className="link-btn danger" onClick={() => remove(d)}>
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && <NewDiagramModal onClose={() => setCreating(false)} onCreate={create} />}
    </div>
  );
}
