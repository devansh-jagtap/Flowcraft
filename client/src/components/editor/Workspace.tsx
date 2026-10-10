import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import type { DiagramDraft, GeneratedDiagram } from '../../api/types';
import { useAiEnabled } from '../../hooks/useAiEnabled';
import { parseDiagram } from '../../lib/diagram/parse';
import { TYPE_INFO } from '../../lib/diagram/templates';
import type { DiagramType, Direction } from '../../lib/diagram/types';
import AiPanel from '../ai/AiPanel';
import DiagramCanvas from '../diagram/DiagramCanvas';
import SourceEditor from './SourceEditor';
import ThemePicker from './ThemePicker';
import { Segmented } from '../ui';

interface Props {
  draft: DiagramDraft;
  onChange: (changes: Partial<DiagramDraft>) => void;
  status?: ReactNode;
  actions?: ReactNode;
}

const TYPE_OPTIONS = (Object.keys(TYPE_INFO) as DiagramType[]).map((t) => ({
  value: t,
  label: TYPE_INFO[t].label,
}));

const DIRECTION_OPTIONS: { value: Direction; label: string; title: string }[] = [
  { value: 'TB', label: 'Vertical', title: 'Top to bottom' },
  { value: 'LR', label: 'Horizontal', title: 'Left to right' },
];

const MAX_UNDO = 10;
const MAX_PROMPTS = 50;

/** The editor UI shared by saved diagrams and the guest playground. */
export default function Workspace({ draft, onChange, status, actions }: Props) {
  const aiEnabled = useAiEnabled();
  const [tab, setTab] = useState<'ai' | 'text'>();
  const activeTab = tab ?? (aiEnabled === false ? 'text' : 'ai');
  // Snapshots taken before each AI change, so a bad suggestion is one click to revert.
  const [undoStack, setUndoStack] = useState<DiagramDraft[]>([]);

  function applyAi(result: GeneratedDiagram, prompt: string) {
    setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), draft]);
    onChange({
      // Keep a title the user chose; the first prompt gets the AI's suggested title.
      title: draft.prompts.length === 0 ? result.title : draft.title,
      type: result.type,
      direction: result.direction,
      source: result.source,
      // Positions belong to the old structure; let auto-layout place the new one.
      positions: {},
      prompts: [...draft.prompts, { text: prompt, createdAt: new Date().toISOString() }].slice(-MAX_PROMPTS),
    });
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    setUndoStack((stack) => stack.slice(0, -1));
    onChange(previous);
  }

  // Deferring the text keeps typing responsive while layout catches up on big diagrams.
  const source = useDeferredValue(draft.source);
  const graph = useMemo(() => parseDiagram(draft.type, source), [draft.type, source]);
  const hasManualLayout = Object.keys(draft.positions).length > 0;

  return (
    <div className="workspace">
      <div className="toolbar">
        <input
          className="title-input"
          value={draft.title}
          maxLength={100}
          onChange={(e) => onChange({ title: e.target.value })}
          aria-label="Diagram title"
        />
        <div className="toolbar-group">
          <Segmented
            label="Diagram type"
            value={draft.type}
            options={TYPE_OPTIONS}
            // Node ids mean different things in each type, so manual positions no longer apply.
            onChange={(type) => onChange({ type, positions: {} })}
          />
          {draft.type === 'flowchart' && (
            <Segmented label="Direction" value={draft.direction} options={DIRECTION_OPTIONS} onChange={(direction) => onChange({ direction, positions: {} })} />
          )}
          <ThemePicker value={draft.theme} onChange={(theme) => onChange({ theme })} />
          {hasManualLayout && (
            <button className="btn btn-ghost btn-sm" onClick={() => onChange({ positions: {} })} title="Forget dragged positions">
              Reset layout
            </button>
          )}
        </div>
        <div className="toolbar-group toolbar-end">
          {status && <span className="save-status">{status}</span>}
          {actions}
        </div>
      </div>

      <div className="workspace-body">
        <aside className="workspace-source">
          <div className="side-tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'ai'} className={activeTab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
              Ask AI
            </button>
            <button role="tab" aria-selected={activeTab === 'text'} className={activeTab === 'text' ? 'active' : ''} onClick={() => setTab('text')}>
              Text
            </button>
          </div>
          {activeTab === 'ai' ? (
            <AiPanel draft={draft} onApply={applyAi} onUndo={undoStack.length ? undo : undefined} />
          ) : (
            <SourceEditor type={draft.type} value={draft.source} onChange={(value) => onChange({ source: value })} issues={graph.issues} />
          )}
        </aside>
        <section className="workspace-canvas">
          <DiagramCanvas
            graph={graph}
            type={draft.type}
            direction={draft.direction}
            theme={draft.theme}
            positions={draft.positions}
            onNodeMove={(id, point) => onChange({ positions: { ...draft.positions, [id]: point } })}
            exportName={draft.title}
            showMiniMap
          />
        </section>
      </div>
    </div>
  );
}
