import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { aiApi, needsOwnKey } from '../../api/ai';
import type { GeneratedDiagram } from '../../api/types';
import { useAiEnabled } from '../../hooks/useAiEnabled';
import { useAiKey } from '../../lib/aiKey';
import { EXAMPLE_PROMPTS } from '../../lib/examples';
import { AiKeyButton, AiKeyNotice, AiUsageLine } from './AiKey';

interface Props {
  onGenerated: (diagram: GeneratedDiagram, prompt: string) => Promise<void> | void;
  size?: 'hero' | 'compact';
  autoFocus?: boolean;
}

/** "Describe your diagram" box used on the landing page and in the new-diagram dialog. */
export default function PromptBox({ onGenerated, size = 'hero', autoFocus }: Props) {
  const enabled = useAiEnabled();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(text: string) {
    const trimmed = text.trim();
    if (trimmed.length < 3 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const diagram = await aiApi.generate(trimmed);
      await onGenerated(diagram, trimmed);
    } catch (err) {
      setError(err);
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
          placeholder="Describe a diagram, like how a UPI payment works"
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
            'Generate'
          )}
        </button>
      </form>

      {busy && <p className="prompt-status">Drawing your diagram. This takes a few seconds.</p>}
      {error !== null && <AiError error={error} />}
      {enabled === false && <AiKeyNotice />}

      {enabled !== false && !busy && (
        <div className="prompt-examples">
          {EXAMPLE_PROMPTS.slice(0, size === 'hero' ? 3 : 4).map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
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
      {enabled && !busy && <AiUsageLine />}
    </div>
  );
}

/** An AI error, with a shortcut to the key dialog when a key would fix it. */
export function AiError({ error }: { error: unknown }) {
  const ownKey = useAiKey();
  return (
    <div className="alert">
      {(error as Error).message}
      {needsOwnKey(error) && (
        <>
          {' '}
          <AiKeyButton>{ownKey ? 'Change your API key' : 'Add your API key'}</AiKeyButton>
        </>
      )}
    </div>
  );
}
