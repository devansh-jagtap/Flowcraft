import { useDeferredValue, useMemo, type ReactNode } from 'react';
import type { DiagramDraft } from '../api/types';
import { parseDiagram } from '../lib/diagram/parse';
import { TYPE_INFO } from '../lib/diagram/templates';
import type { DiagramType, Direction } from '../lib/diagram/types';
import DiagramCanvas from './diagram/DiagramCanvas';
import SourceEditor from './SourceEditor';
import ThemePicker from './ThemePicker';
import { Segmented } from './ui';

interface Props {
  draft: DiagramDraft;
  onChange: (changes: Partial<DiagramDraft>) => void;
  status?: ReactNode;
  actions?: ReactNode;
}

const TYPE_OPTIONS = (Object.keys(TYPE_INFO) as DiagramType[]).map((t) => ({
  value: t,
  label: (
    <>
      <span aria-hidden>{TYPE_INFO[t].icon}</span> <span className="hide-sm">{TYPE_INFO[t].label}</span>
    </>
  ),
  title: TYPE_INFO[t].label,
}));

const DIRECTION_OPTIONS: { value: Direction; label: string; title: string }[] = [
  { value: 'TB', label: '↓', title: 'Top to bottom' },
  { value: 'LR', label: '→', title: 'Left to right' },
];

/** The editor UI shared by saved diagrams and the guest playground. */
export default function Workspace({ draft, onChange, status, actions }: Props) {
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
              ↺ Tidy up
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
          <SourceEditor type={draft.type} value={draft.source} onChange={(value) => onChange({ source: value })} issues={graph.issues} />
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
