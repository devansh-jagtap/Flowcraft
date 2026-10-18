import { CheckCircle, Eye, EyeSlash, Gift, Key, WarningCircle } from '@phosphor-icons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { aiApi, type FreeUsage } from '../../api/ai';
import { ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAiStatus } from '../../hooks/useAiEnabled';
import {
  detectProvider,
  maskKey,
  PROVIDER_ORDER,
  PROVIDERS,
  removeProviderKey,
  saveProviderKey,
  setActiveProvider,
  useAiKeys,
  type AiProvider,
} from '../../lib/aiKey';
import { timeAgo } from '../../lib/format';
import { Modal } from '../ui';

/** "in 3 h" / "in 12 min" until the free generations come back. */
export function resetsIn(resetsAt: string | null) {
  if (!resetsAt) return '';
  const minutes = Math.max(1, Math.round((new Date(resetsAt).getTime() - Date.now()) / 60_000));
  return minutes >= 60 ? `in ${Math.round(minutes / 60)} h` : `in ${minutes} min`;
}

export function freeSummary(free: FreeUsage) {
  if (free.limit === 0) return 'No free generations on this site';
  if (free.remaining > 0) return `${free.remaining} of ${free.limit} free generation${free.limit === 1 ? '' : 's'} left`;
  const reset = resetsIn(free.resetsAt);
  return `Free generations used up${reset ? `, more ${reset}` : ''}`;
}

/** Add or edit one provider's key. Testing first catches wrong keys and model names before they fail a drawing. */
function KeyForm({ provider, onDone }: { provider: AiProvider; onDone: () => void }) {
  const toast = useToast();
  const saved = useAiKeys().keys[provider];
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '');
  const [model, setModel] = useState(saved?.model ?? '');
  const [reveal, setReveal] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const info = PROVIDERS[provider];
  const trimmed = apiKey.trim();
  const detected = detectProvider(trimmed);
  const mismatch = detected && detected !== provider ? detected : null;

  function save(verified: boolean, as: AiProvider = provider) {
    saveProviderKey(as, { apiKey: trimmed, model: model.trim() || undefined, ...(verified && { verifiedAt: new Date().toISOString() }) });
    toast(`${PROVIDERS[as].label} key saved${verified ? ' and working' : ''}`, 'success');
    onDone();
  }

  async function testAndSave(e: FormEvent) {
    e.preventDefault();
    setTesting(true);
    setError('');
    try {
      await aiApi.testKey({ provider, apiKey: trimmed, model: model.trim() || undefined });
      save(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not test the key. Check your connection.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <form className="key-form" onSubmit={testAndSave}>
      <label className="field">
        <span>API key</span>
        <div className="key-input">
          <input
            type={reveal ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
            }}
            placeholder={info.keyHint}
            autoComplete="off"
            spellCheck={false}
            required
            minLength={10}
            maxLength={400}
            autoFocus
          />
          <button type="button" className="icon-btn" onClick={() => setReveal((r) => !r)} aria-label={reveal ? 'Hide key' : 'Show key'}>
            {reveal ? <EyeSlash aria-hidden /> : <Eye aria-hidden />}
          </button>
        </div>
      </label>

      {mismatch && (
        <div className="key-hint warn">
          <WarningCircle aria-hidden weight="fill" />
          <span>
            This looks like a {PROVIDERS[mismatch].label} key.{' '}
            <button type="button" className="link-btn" onClick={() => save(false, mismatch)}>
              Save it under {PROVIDERS[mismatch].label}
            </button>
          </span>
        </div>
      )}

      <label className="field">
        <span>
          Model <span className="muted">(optional, default {info.defaultModel})</span>
        </span>
        <input
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setError('');
          }}
          placeholder={info.modelHint}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          pattern={provider === 'gemini' ? '[\\w.:\\-]*' : '[\\w.:\\/\\-]*'}
        />
      </label>

      {error && (
        <div className="key-hint error" role="alert">
          <WarningCircle aria-hidden weight="fill" />
          <span>
            {error}{' '}
            <button type="button" className="link-btn" onClick={() => save(false)}>
              Save anyway
            </button>
          </span>
        </div>
      )}

      <div className="key-form-actions">
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="small">
          Get a {info.label} key
        </a>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={testing || trimmed.length < 10}>
          {testing ? 'Testing…' : 'Test and save'}
        </button>
      </div>
    </form>
  );
}

/** One provider: its saved key, whether it works, and the actions for it. */
export function ProviderKeyCard({ provider }: { provider: AiProvider }) {
  const toast = useToast();
  const { keys, active } = useAiKeys();
  const saved = keys[provider];
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const info = PROVIDERS[provider];
  const isActive = active === provider;

  async function test() {
    if (!saved) return;
    setTesting(true);
    try {
      const result = await aiApi.testKey({ provider, apiKey: saved.apiKey, model: saved.model });
      saveProviderKey(provider, { apiKey: saved.apiKey, model: saved.model, verifiedAt: new Date().toISOString() });
      toast(`${info.label} key works (${result.model}, ${(result.latencyMs / 1000).toFixed(1)} s)`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  }

  return (
    <article className={`provider-card${isActive ? ' is-active' : ''}`}>
      <header className="provider-card-head">
        <span className={`provider-mark provider-${provider}`} aria-hidden>
          {info.label[0]}
        </span>
        <div className="provider-card-title">
          <h3>{info.label}</h3>
          <p className="muted small">{info.note}</p>
        </div>
        {isActive && <span className="badge badge-primary">In use</span>}
      </header>

      {editing || !saved ? (
        editing ? (
          <KeyForm provider={provider} onDone={() => setEditing(false)} />
        ) : (
          <div className="provider-card-empty">
            <p className="muted small">No key added.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Key aria-hidden /> Add key
            </button>
          </div>
        )
      ) : (
        <>
          <dl className="provider-facts">
            <div>
              <dt>Key</dt>
              <dd className="mono">{maskKey(saved.apiKey)}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd className="mono">{saved.model || `${info.defaultModel} (default)`}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                {saved.verifiedAt ? (
                  <span className="status-ok">
                    <CheckCircle weight="fill" aria-hidden /> Working · tested {timeAgo(saved.verifiedAt)}
                  </span>
                ) : (
                  <span className="muted">Not tested yet</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="provider-card-actions">
            {!isActive && (
              <button className="btn btn-primary btn-sm" onClick={() => setActiveProvider(provider)}>
                Use this key
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={test} disabled={testing}>
              {testing ? 'Testing…' : 'Test'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button
              className="btn btn-ghost btn-sm danger"
              onClick={() => {
                removeProviderKey(provider);
                toast(`${info.label} key removed from this browser`, 'success');
              }}
            >
              Remove
            </button>
          </div>
        </>
      )}
    </article>
  );
}

/** Choose what generates diagrams: the free generations or one of the saved keys. */
export function ActiveSourcePicker() {
  const { keys, active } = useAiKeys();
  const { free, freeTier } = useAiStatus();
  const savedProviders = PROVIDER_ORDER.filter((p) => keys[p]);

  return (
    <div className="source-picker" role="radiogroup" aria-label="Generate diagrams with">
      <button
        type="button"
        role="radio"
        aria-checked={active === null}
        className="source-option"
        onClick={() => setActiveProvider(null)}
        disabled={!freeTier}
      >
        <Gift aria-hidden />
        <span>
          <strong>Free generations</strong>
          <small>{freeTier ? `${free ? freeSummary(free) : '…'} · ${freeTier.label}` : 'Not available on this site'}</small>
        </span>
      </button>
      {savedProviders.map((provider) => (
        <button
          key={provider}
          type="button"
          role="radio"
          aria-checked={active === provider}
          className="source-option"
          onClick={() => setActiveProvider(provider)}
        >
          <span className={`provider-mark provider-${provider}`} aria-hidden>
            {PROVIDERS[provider].label[0]}
          </span>
          <span>
            <strong>Your {PROVIDERS[provider].label} key</strong>
            <small className="mono">{keys[provider]!.model || PROVIDERS[provider].defaultModel}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

/** The picker plus one card per provider. Used on the AI page and in the quick dialog. */
export function AiKeysPanel() {
  return (
    <div className="keys-panel">
      <section>
        <h2 className="section-label first">Generate diagrams with</h2>
        <ActiveSourcePicker />
      </section>
      <section>
        <h2 className="section-label">Your API keys</h2>
        <div className="provider-grid">
          {PROVIDER_ORDER.map((provider) => (
            <ProviderKeyCard key={provider} provider={provider} />
          ))}
        </div>
        <p className="key-privacy muted small">
          Keys are saved only in this browser and sent with each AI request over HTTPS. The server uses them for that request and never
          stores or logs them.
        </p>
      </section>
    </div>
  );
}

export function AiKeyDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="AI keys" onClose={onClose} wide>
      <AiKeysPanel />
      <div className="dialog-actions">
        <Link to="/ai" className="btn btn-ghost" onClick={onClose}>
          See usage and all settings
        </Link>
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
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

/** One quiet line under the prompt: which key or free tier is in use, with a way to change it. */
export function AiUsageLine() {
  const { ownKey, free } = useAiStatus();
  if (ownKey) {
    return (
      <p className="ai-usage">
        Using your {PROVIDERS[ownKey.provider].label} key · {ownKey.model || PROVIDERS[ownKey.provider].defaultModel} ·{' '}
        <AiKeyButton>Change</AiKeyButton>
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
