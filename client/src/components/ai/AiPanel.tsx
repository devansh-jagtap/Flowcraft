import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { aiApi } from '../api/ai';
import type { DiagramDraft, GeneratedDiagram } from '../api/types';
import { useAiEnabled } from '../hooks/useAiEnabled';
import { REFINE_EXAMPLES } from '../lib/examples';
import { timeAgo } from '../lib/format';
import { AiSetupNotice } from './PromptBox';

interface Props {
  draft: DiagramDraft;
  onApply: (diagram: GeneratedDiagram, prompt: string) => void;
  onUndo?: () => void;
}

/** Chat-style panel: every message is a change request applied to the current diagram. */
export default function AiPanel({ draft, onApply, onUndo }: Props) {
  const enabled = useAiEnabled();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const isEmpty = !draft.source.trim();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [draft.prompts.length, busy]);

  async function run(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await aiApi.generate(trimmed, isEmpty ? undefined : { type: draft.type, source: draft.source });
      onApply(result, trimmed);
      setPrompt('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(prompt);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run(prompt);
    }
  };

  if (enabled === false) {
    return (
      <div className="ai-panel">
        <AiSetupNotice />
      </div>
    );
  }

  return (
    <div className="ai-panel">
      <ol className="ai-history" ref={listRef}>
        {draft.prompts.length === 0 && !busy && (
          <li className="ai-empty">
            <strong>{isEmpty ? 'Describe your diagram' : 'Ask for changes'}</strong>
            <span className="muted small">
              {isEmpty ? 'Tell the AI what you want to visualise.' : 'The AI edits the current diagram — you can undo any change.'}
            </span>
          </li>
        )}
        {draft.prompts.map((p, i) => (
          <li key={`${p.createdAt}-${i}`} className="ai-message">
            <span>{p.text}</span>
            <time className="muted" dateTime={p.createdAt}>
              {timeAgo(p.createdAt)}
            </time>
          </li>
        ))}
        {busy && (
          <li className="ai-message ai-thinking">
            <span className="dots" aria-label="Thinking">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
      </ol>

      {error && <div className="alert">{error}</div>}
      {onUndo && !busy && (
        <button className="link-btn undo-btn" onClick={onUndo}>
          ↶ Undo last AI change
        </button>
      )}

      {!busy && !isEmpty && (
        <div className="prompt-examples">
          {REFINE_EXAMPLES[draft.type].map((example) => (
            <button key={example} type="button" className="chip chip-soft" onClick={() => setPrompt(example)}>
              {example}
            </button>
          ))}
        </div>
      )}

      <form className={`prompt-form compact${busy ? ' is-busy' : ''}`} onSubmit={onSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={600}
          disabled={busy}
          placeholder={isEmpty ? 'e.g. How does a train ticket booking work?' : 'e.g. Add a step for refunds'}
          aria-label={isEmpty ? 'Describe your diagram' : 'Describe a change'}
        />
        <button className="btn btn-primary btn-sm prompt-submit" disabled={busy || prompt.trim().length < 3}>
          {busy ? '…' : '✨ Send'}
        </button>
      </form>
    </div>
  );
}
