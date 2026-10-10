import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { aiApi } from '../api/ai';
import type { GeneratedDiagram } from '../api/types';
import { useAiEnabled } from '../hooks/useAiEnabled';
import { EXAMPLE_PROMPTS } from '../lib/examples';

interface Props {
  onGenerated: (diagram: GeneratedDiagram, prompt: string) => Promise<void> | void;
  size?: 'hero' | 'compact';
  autoFocus?: boolean;
}

export function AiSetupNotice() {
  return (
    <div className="ai-notice">
      <strong>AI isn't switched on yet.</strong> Add a free Gemini key from{' '}
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
        Google AI Studio
      </a>{' '}
      as <code>GEMINI_API_KEY</code> in <code>server/.env</code>, then restart the server. You can still use templates or write the text yourself.
    </div>
  );
}

/** "Describe your diagram" box used on the landing page and in the new-diagram dialog. */
export default function PromptBox({ onGenerated, size = 'hero', autoFocus }: Props) {
  const enabled = useAiEnabled();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError('');
    try {
      const diagram = await aiApi.generate(trimmed);
      await onGenerated(diagram, trimmed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run(prompt);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter generates, Shift+Enter adds a new line (like chat apps).
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void run(prompt);
    }
  }

  return (
    <div className={`prompt-box prompt-${size}`}>
      <form onSubmit={onSubmit} className={`prompt-form${busy ? ' is-busy' : ''}`}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe the diagram you want… e.g. “How does UPI payment work?”"
          maxLength={600}
          rows={size === 'hero' ? 3 : 2}
          disabled={busy || enabled === false}
          autoFocus={autoFocus}
          aria-label="Describe your diagram"
        />
        <button className="btn btn-primary prompt-submit" disabled={busy || enabled === false || prompt.trim().length < 3}>
          {busy ? (
            <>
              <span className="spinner spinner-sm" aria-hidden /> Drawing…
            </>
          ) : (
            '✨ Generate'
          )}
        </button>
      </form>

      {busy && <p className="prompt-status">Thinking about the best layout for your diagram… this takes a few seconds.</p>}
      {error && <div className="alert">{error}</div>}
      {enabled === false && <AiSetupNotice />}

      {enabled !== false && !busy && (
        <div className="prompt-examples">
          <span className="muted small">Try:</span>
          {EXAMPLE_PROMPTS.slice(0, size === 'hero' ? 6 : 4).map((example) => (
            <button
              key={example}
              type="button"
              className="chip chip-soft"
              onClick={() => {
                setPrompt(example);
                void run(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
