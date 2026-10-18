import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { Diagram, DiagramDraft } from '../api/types';
import ShareModal from '../components/editor/ShareModal';
import { ErrorState, Spinner } from '../components/ui';
import Workspace from '../components/editor/Workspace';
import { useAsync } from '../hooks/useAsync';

type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'untitled';

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
          <Link to="/app">Back to my diagrams</Link>
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
  // One save at a time: overlapping requests could finish out of order and leave older content saved.
  const inFlightRef = useRef<Promise<void> | null>(null);
  const againRef = useRef(false);

  const save = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) {
      // Save again, with the latest edits, once the current request finishes.
      againRef.current = true;
      return inFlightRef.current;
    }
    const changes = diff(savedRef.current, draftRef.current);
    if (Object.keys(changes).length === 0) return setSaveState('saved');
    if (changes.title !== undefined && !changes.title.trim()) return setSaveState('untitled');

    const snapshot = draftRef.current;
    setSaveState('saving');
    const request = (async () => {
      try {
        await diagramsApi.update(diagram._id, changes);
        savedRef.current = snapshot;
        setSaveState(draftRef.current === snapshot ? 'saved' : 'pending');
      } catch {
        setSaveState('error');
        againRef.current = false;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = request;
    await request;
    if (againRef.current) {
      againRef.current = false;
      await save();
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
    saved: 'Saved',
    pending: 'Unsaved changes',
    saving: 'Saving…',
    untitled: 'Add a title to save',
    error: (
      <button className="link-btn danger" onClick={() => void save()}>
        Save failed. Retry
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
              All diagrams
            </Link>
            <button className="btn btn-primary btn-sm" onClick={() => setSharing(true)}>
              {diagram.isPublic ? 'Shared' : 'Share'}
            </button>
          </>
        }
      />
      {sharing && <ShareModal diagram={diagram} onChange={onDiagramChange} onClose={() => setSharing(false)} />}
    </>
  );
}
