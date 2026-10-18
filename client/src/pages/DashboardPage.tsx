import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { Diagram } from '../api/types';
import DiagramCard, { DiagramCardSkeletons } from '../components/library/DiagramCard';
import LibrarySidebar, { viewTitle, type View } from '../components/library/LibrarySidebar';
import NewDiagramModal, { type NewDiagramChoice } from '../components/library/NewDiagramModal';
import { ConfirmDialog, EmptyState, ErrorState } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { pendingImport } from '../lib/draft';

/** "My diagrams": a library window with a sidebar of views and a grid of diagrams. */
export default function DashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Diagram | null>(null);
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
    const draft = pendingImport.peek();
    if (!draft) return;
    diagramsApi
      .create(draft)
      .then((diagram) => {
        // Only forget the browser copy once it is safely in the account.
        pendingImport.done();
        toast('Your playground diagram was saved', 'success');
        navigate(`/d/${diagram._id}`);
      })
      .catch((err: Error) => toast(`Could not save your playground diagram yet (it is still in the editor): ${err.message}`, 'error'));
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
      // In the Starred view, an unstarred diagram no longer belongs in the list.
      if (view === 'starred' && diagram.starred) list.setData((items) => items?.filter((d) => d._id !== diagram._id));
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
    setDeleting(null);
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
      <LibrarySidebar view={view} onChange={setView} stats={stats.data} />

      <section className="library-main">
        <header className="library-toolbar">
          <div className="library-heading">
            <h1>{viewTitle(view)}</h1>
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
            <option value="title">Title A-Z</option>
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New diagram
          </button>
        </header>

        <div className="library-content">
          {list.loading && !list.data && <DiagramCardSkeletons />}
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
                <DiagramCard key={d._id} diagram={d} onStar={toggleStar} onDuplicate={duplicate} onDelete={setDeleting} />
              ))}
            </div>
          )}
        </div>
      </section>

      {creating && <NewDiagramModal onClose={() => setCreating(false)} onCreate={create} />}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.title}"?`}
          message="This can't be undone. Shared links to it will stop working."
          confirmLabel="Delete"
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
