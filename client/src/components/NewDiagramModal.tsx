import { useState } from 'react';
import { BLANK_SOURCE, TEMPLATES, TYPE_INFO, type Template } from '../lib/diagram/templates';
import type { DiagramType } from '../lib/diagram/types';
import { draftFromGenerated } from '../lib/draft';
import { DiagramThumbnail } from './diagram/DiagramThumbnail';
import PromptBox from './PromptBox';
import { Modal } from './ui';

export interface NewDiagramChoice {
  type: DiagramType;
  title: string;
  source: string;
  theme: Template['theme'];
  direction: Template['direction'];
  prompts?: { text: string; createdAt: string }[];
}

interface Props {
  onClose: () => void;
  onCreate: (choice: NewDiagramChoice) => Promise<void> | void;
}

const TYPES = Object.keys(TYPE_INFO) as DiagramType[];

export default function NewDiagramModal({ onClose, onCreate }: Props) {
  const [type, setType] = useState<DiagramType>('flowchart');
  const [busy, setBusy] = useState(false);

  async function choose(choice: NewDiagramChoice) {
    setBusy(true);
    try {
      await onCreate(choice);
    } finally {
      setBusy(false);
    }
  }

  const templates = TEMPLATES.filter((t) => t.type === type);

  return (
    <Modal title="New diagram" onClose={onClose} wide>
      <h3 className="section-label first">✨ Describe it and let AI draw it</h3>
      <PromptBox size="compact" autoFocus onGenerated={(diagram, prompt) => choose(draftFromGenerated(diagram, prompt))} />

      <h3 className="section-label">…or pick a type and start from a template</h3>
      <div className="type-picker">
        {TYPES.map((t) => (
          <button key={t} className={`type-option${t === type ? ' active' : ''}`} onClick={() => setType(t)}>
            <span className="type-icon">{TYPE_INFO[t].icon}</span>
            <strong>{TYPE_INFO[t].label}</strong>
            <span className="muted small">{TYPE_INFO[t].hint}</span>
          </button>
        ))}
      </div>

      <div className="spacer" />
      <div className="template-grid">
        <button
          className="template-card blank"
          disabled={busy}
          onClick={() =>
            choose({ type, title: `Untitled ${TYPE_INFO[type].label.toLowerCase()}`, source: BLANK_SOURCE[type], theme: 'ocean', direction: 'TB' })
          }
        >
          <div className="thumb thumb-blank">＋</div>
          <strong>Blank</strong>
        </button>
        {templates.map((t) => (
          <button
            key={t.id}
            className="template-card"
            disabled={busy}
            onClick={() => choose({ type: t.type, title: t.name, source: t.source, theme: t.theme, direction: t.direction })}
          >
            <DiagramThumbnail type={t.type} source={t.source} theme={t.theme} direction={t.direction} />
            <strong>{t.name}</strong>
            <span className="muted small">{t.description}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
