import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { Diagram, DiagramDraft } from '../api/types';
import ShareModal from '../components/ShareModal';
import { ErrorState, Spinner } from '../components/ui';
import Workspace from '../components/Workspace';
import { useAsync } from '../hooks/useAsync';

type SaveState = 'saved' | 'pending' | 'saving' | 'error';

const AUTOSAVE_DELAY = 800;
const FIELDS = ['title', 'type', 'source', 'theme', 'direction', 'positions', 'prompts'] as const;

const toDraft = (d: Diagram): DiagramDraft => ({
  title: d.title,
  type: d.type,
  source: d.source,
  theme: d.theme,
  direction: d.direction,
  positions: d.positions ?? {},
  prompts: d.prompts ?? [],
});

/** Only send fields that actually changed since the last successful save. */
function diff(saved: DiagramDraft, current: DiagramDraft): Partial<DiagramDraft> {
  const changes: Partial<DiagramDraft> = {};
  for (const key of FIELDS) {
    if (JSON.stringify(saved[key]) !== JSON.stringify(current[key])) {
      (changes as Record<string, unknown>)[key] = current[key];
    }
  }
  return changes;
}

export default function EditorPage() {
  const { id = '' } = useParams();
  const { data: diagram, error, loading, reload, setData } = useAsync((signal) => diagramsApi.get(id, signal), [id]);

  if (loading) return <Spinner fullPage />;
  if (error || !diagram) {
    return (
      <div className="container page">
        <ErrorState error={error ?? new Error('Diagram not found')} onRetry={reload} />
        <p className="center">
          <Link to="/app">← Back to my diagrams</Link>
        </p>
      </div>
    );
  }
  return <Editor key={diagram._id} diagram={diagram} onDiagramChange={(d) => setData(() => d)} />;
}

function Editor({ diagram, onDiagramChange }: { diagram: Diagram; onDiagramChange: (d: Diagram) => void }) {
  const [draft, setDraft] = useState(() => toDraft(diagram));
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [sharing, setSharing] = useState(false);
  const savedRef = useRef(draft);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const save = useCallback(async () => {
    const changes = diff(savedRef.current, draftRef.current);
    if (Object.keys(changes).length === 0) return setSaveState('saved');
    if (changes.title !== undefined && !changes.title.trim()) return; // wait for a real title

    const snapshot = draftRef.current;
    setSaveState('saving');
    try {
      await diagramsApi.update(diagram._id, changes);
      savedRef.current = snapshot;
      // More edits may have happened while the request was in flight.
      setSaveState(draftRef.current === snapshot ? 'saved' : 'pending');
    } catch {
      setSaveState('error');
    }
  }, [diagram._id]);

  // Debounced autosave.
  useEffect(() => {
    if (draft === savedRef.current) return;
    setSaveState('pending');
    const timer = setTimeout(save, AUTOSAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, save]);

  // Warn before closing the tab with unsaved work, and flush on in-app navigation.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(diff(savedRef.current, draftRef.current)).length) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      void save();
    };
  }, [save]);

  const status = {
    saved: '✓ Saved',
    pending: 'Unsaved changes',
    saving: 'Saving…',
    error: (
      <button className="link-btn danger" onClick={save}>
        ⚠ Save failed — retry
      </button>
    ),
  }[saveState];

  return (
    <>
      <Workspace
        draft={draft}
        onChange={(changes) => setDraft((d) => ({ ...d, ...changes }))}
        status={status}
        actions={
          <>
            <Link to="/app" className="btn btn-ghost btn-sm">
              ← All diagrams
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setSharing(true)}>
              {diagram.isPublic ? '🔗 Shared' : 'Share'}
            </button>
          </>
        }
      />
      {sharing && <ShareModal diagram={diagram} onChange={onDiagramChange} onClose={() => setSharing(false)} />}
    </>
  );
}
