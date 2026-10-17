import { useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { FreeUsage } from '../../api/ai';
import { useToast } from '../../context/ToastContext';
import { useAiStatus } from '../../hooks/useAiEnabled';
import { maskKey, PROVIDERS, setAiKey, useAiKey, type AiProvider } from '../../lib/aiKey';
import { Modal, Segmented } from '../ui';

const PROVIDER_OPTIONS = (Object.keys(PROVIDERS) as AiProvider[]).map((value) => ({ value, label: PROVIDERS[value].label }));

/** "in 3 h" / "in 12 min" until the free generations come back. */
function resetsIn(resetsAt: string | null) {
  if (!resetsAt) return '';
  const minutes = Math.max(1, Math.round((new Date(resetsAt).getTime() - Date.now()) / 60_000));
  return minutes >= 60 ? `in ${Math.round(minutes / 60)} h` : `in ${minutes} min`;
}

function freeSummary(free: FreeUsage) {
  if (free.remaining > 0) return `${free.remaining} of ${free.limit} free generation${free.limit === 1 ? '' : 's'} left`;
  const reset = resetsIn(free.resetsAt);
  return `Free generations used up${reset ? `, more ${reset}` : ''}`;
}

export function AiKeyDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const saved = useAiKey();
  const { free } = useAiStatus();
  const [provider, setProvider] = useState<AiProvider>(saved?.provider ?? 'gemini');
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '');
  const [model, setModel] = useState(saved?.model ?? '');
  const info = PROVIDERS[provider];

  function save(e: FormEvent) {
    e.preventDefault();
    setAiKey({ provider, apiKey: apiKey.trim(), ...(model.trim() && { model: model.trim() }) });
    toast(`Using your ${info.label} key`, 'success');
    onClose();
  }

  function remove() {
    setAiKey(null);
    toast('Your API key was removed from this browser', 'success');
    onClose();
  }

  return (
    <Modal title="Use your own AI key" onClose={onClose}>
      <form className="stack ai-key-form" onSubmit={save}>
        <p className="muted small">
          {free && free.limit > 0 ? `Everyone gets ${free.limit} free AI generation${free.limit === 1 ? '' : 's'}. ` : ''}
          Add an API key from your own account to generate as much as you like.
        </p>

        <Segmented label="Provider" value={provider} options={PROVIDER_OPTIONS} onChange={setProvider} />

        <label className="field">
          <span>API key</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={info.keyHint}
            autoComplete="off"
            spellCheck={false}
            required
            minLength={10}
            maxLength={400}
            autoFocus
          />
          <small className="muted">
            {info.note}{' '}
            <a href={info.keyUrl} target="_blank" rel="noreferrer">
              Get a {info.label} key
            </a>
          </small>
        </label>

        <label className="field">
          <span>
            Model <span className="muted">(optional)</span>
          </span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={info.defaultModel}
            autoComplete="off"
            spellCheck={false}
            maxLength={100}
            pattern="[\w.:\/\-]*"
          />
        </label>

        <p className="ai-key-privacy muted small">
          Your key is saved only in this browser. It is sent with each AI request over HTTPS, used for that request, and never stored or
          logged on our server.
        </p>

        <div className="dialog-actions">
          {saved && (
            <button type="button" className="btn btn-ghost ai-key-remove" onClick={remove}>
              Remove key
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={apiKey.trim().length < 10}>
            Save key
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** A button that opens the key dialog. The dialog is portalled so it can sit inside text and other dialogs. */
export function AiKeyButton({ children, className = 'link-btn' }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && createPortal(<AiKeyDialog onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

/** One quiet line under the prompt: how many free generations are left, or which key is in use. */
export function AiUsageLine() {
  const { ownKey, free } = useAiStatus();
  if (ownKey) {
    return (
      <p className="ai-usage">
        Using your {PROVIDERS[ownKey.provider].label} key ({maskKey(ownKey.apiKey)}) · <AiKeyButton>Change</AiKeyButton>
      </p>
    );
  }
  if (!free) return null;
  return (
    <p className="ai-usage">
      {freeSummary(free)} · <AiKeyButton>Use your own key</AiKeyButton>
    </p>
  );
}

/** Shown instead of the prompt when AI can't run until the visitor adds a key. */
export function AiKeyNotice() {
  const { reason, free } = useAiStatus();
  let message: ReactNode;
  if (reason === 'free-used' && free && free.limit > 0) {
    const reset = resetsIn(free.resetsAt);
    message = (
      <>
        <strong>You've used your free AI generations.</strong> Add your own API key to keep going
        {reset ? `, or come back ${reset}` : ''}.
      </>
    );
  } else {
    message = (
      <>
        <strong>AI generation needs an API key.</strong> Add a free{' '}
        <a href={PROVIDERS.gemini.keyUrl} target="_blank" rel="noreferrer">
          Gemini
        </a>{' '}
        key, or one from OpenAI or Vercel AI Gateway. It stays in this browser.
      </>
    );
  }
  return (
    <div className="ai-notice">
      <p>{message} You can still use templates or write the text yourself.</p>
      <AiKeyButton className="btn btn-primary btn-sm">Add your API key</AiKeyButton>
      {reason === 'no-server-key' && (
        <p className="muted small">
          Running your own copy? Set <code>GEMINI_API_KEY</code> or <code>AI_GATEWAY_API_KEY</code> in <code>server/.env</code> to give
          visitors free generations.
        </p>
      )}
    </div>
  );
}
