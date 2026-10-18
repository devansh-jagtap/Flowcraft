import { SignInButton } from '@clerk/react';
import { CheckCircle, Eye, EyeSlash, Gift, Key, LockSimple, WarningCircle } from '@phosphor-icons/react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAiStatus } from '../../hooks/useAiEnabled';
import {
  detectProvider,
  PROVIDER_ORDER,
  PROVIDERS,
  removeKey,
  saveKey,
  setActiveKey,
  testKey,
  useAiKeys,
  type AiProvider,
} from '../../lib/aiKey';
import { timeAgo } from '../../lib/format';
import { freeSummary, resetsIn } from '../../lib/freeUsage';
import { Modal, Spinner } from '../ui';

/** "an OpenAI key", "a Gemini key". */
const withArticle = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`;

const errorMessage = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong. Try again.');

/** Add or edit one provider's key. Testing first catches wrong keys and model names before they fail a drawing. */
function KeyForm({ provider, onDone }: { provider: AiProvider; onDone: () => void }) {
  const toast = useToast();
  const { keys, storage } = useAiKeys();
  const saved = keys[provider];
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(saved?.model ?? '');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const info = PROVIDERS[provider];
  const trimmed = apiKey.trim();
  const detected = detectProvider(trimmed);
  const mismatch = detected && detected !== provider ? detected : null;
  // Editing a saved key: leaving the key empty keeps it and only changes the model.
  const keepsKey = Boolean(saved) && trimmed === '';
  const canSave = keepsKey || trimmed.length >= 10;

  async function save(test: boolean, as: AiProvider = provider) {
    setBusy(true);
    setError('');
    try {
      await saveKey(as, { apiKey: keepsKey ? undefined : trimmed, model: model.trim(), test });
      const where = storage === 'account' ? ' to your account' : '';
      toast(`${PROVIDERS[as].label} key saved${where}${test ? ' and working' : ''}`, 'success');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void save(true);
  }

  return (
    <form className="key-form" onSubmit={onSubmit}>
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
            placeholder={saved ? `Leave empty to keep ${saved.hint}` : info.keyHint}
            autoComplete="off"
            spellCheck={false}
            required={!saved}
            minLength={saved ? undefined : 10}
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
            This looks like {withArticle(PROVIDERS[mismatch].label)} key.{' '}
            <button type="button" className="link-btn" onClick={() => void save(false, mismatch)} disabled={busy}>
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
            {canSave && (
              <button type="button" className="link-btn" onClick={() => void save(false)} disabled={busy}>
                Save anyway
              </button>
            )}
          </span>
        </div>
      )}

      <div className="key-form-actions">
        <a href={info.keyUrl} target="_blank" rel="noreferrer" className="small">
          Get {withArticle(info.label)} key
        </a>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button className="btn btn-primary btn-sm" disabled={busy || !canSave}>
          {busy ? 'Checking…' : 'Test and save'}
        </button>
      </div>
    </form>
  );
}

/** One provider: its saved key, whether it works, and the actions for it. */
export function ProviderKeyCard({ provider }: { provider: AiProvider }) {
  const toast = useToast();
  const { keys, active, storage } = useAiKeys();
  const saved = keys[provider];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<'test' | 'use' | 'remove' | null>(null);
  const info = PROVIDERS[provider];
  const isActive = active === provider;

  async function run(action: 'test' | 'use' | 'remove') {
    setBusy(action);
    try {
      if (action === 'test') {
        const result = await testKey(provider);
        toast(`${info.label} key works (${result.model}, ${(result.latencyMs / 1000).toFixed(1)} s)`, 'success');
      } else if (action === 'use') {
        await setActiveKey(provider);
        toast(`New diagrams use your ${info.label} key`, 'success');
      } else {
        await removeKey(provider);
        toast(`${info.label} key removed${storage === 'account' ? ' from your account' : ' from this browser'}`, 'success');
      }
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(null);
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

      {editing ? (
        <KeyForm provider={provider} onDone={() => setEditing(false)} />
      ) : !saved ? (
        <div className="provider-card-empty">
          <p className="muted small">No key added.</p>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
            <Key aria-hidden /> Add key
          </button>
        </div>
      ) : (
        <>
          <dl className="provider-facts">
            <div>
              <dt>Key</dt>
              <dd className="mono">{saved.hint}</dd>
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
              <button className="btn btn-primary btn-sm" onClick={() => void run('use')} disabled={busy !== null}>
                {busy === 'use' ? 'Switching…' : 'Use this key'}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => void run('test')} disabled={busy !== null}>
              {busy === 'test' ? 'Testing…' : 'Test'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)} disabled={busy !== null}>
              Edit
            </button>
            <button className="btn btn-ghost btn-sm danger" onClick={() => void run('remove')} disabled={busy !== null}>
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
  const toast = useToast();
  const { keys, active } = useAiKeys();
  const { free, freeTier } = useAiStatus();
  const savedProviders = PROVIDER_ORDER.filter((p) => keys[p]);

  async function choose(provider: AiProvider | null) {
    try {
      await setActiveKey(provider);
    } catch (err) {
      toast(errorMessage(err), 'error');
    }
  }

  return (
    <div className="source-picker" role="radiogroup" aria-label="Generate diagrams with">
      <button
        type="button"
        role="radio"
        aria-checked={active === null}
        className="source-option"
        onClick={() => void choose(null)}
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
          onClick={() => void choose(provider)}
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

/** Where keys are kept, said plainly. */
function StorageNote() {
  const { storage } = useAiKeys();
  const { signedIn, limits } = useAiStatus();
  if (storage === 'account') {
    return (
      <p className="key-privacy muted small">
        <LockSimple aria-hidden /> Saved to your account, encrypted. They work on any device you sign in on, and only a masked hint is
        ever shown.
      </p>
    );
  }
  return (
    <p className="key-privacy muted small">
      <LockSimple aria-hidden /> Saved only in this browser.{' '}
      {signedIn ? (
        'This server is not set up to save keys to accounts.'
      ) : (
        <>
          <SignInButton>
            <button className="link-btn">Sign in</button>
          </SignInButton>{' '}
          to keep them with your account{limits && limits.account > limits.guest ? ` and get ${limits.account} free generations a day` : ''}.
        </>
      )}
    </p>
  );
}

/** The picker plus one card per provider. Used on the AI page and in the quick dialog. */
export function AiKeysPanel() {
  const { loading } = useAiKeys();
  return (
    <div className="keys-panel">
      {loading ? (
        <Spinner />
      ) : (
        <>
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
            <StorageNote />
          </section>
        </>
      )}
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
  const { ownKey, free, signedIn, limits } = useAiStatus();
  if (ownKey) {
    return (
      <p className="ai-usage">
        Using your {PROVIDERS[ownKey.provider].label} key · {ownKey.model || PROVIDERS[ownKey.provider].defaultModel} ·{' '}
        <AiKeyButton>Change</AiKeyButton>
      </p>
    );
  }
  if (!free) return null;
  const moreWithAccount = !signedIn && limits && limits.account > limits.guest;
  return (
    <p className="ai-usage">
      {freeSummary(free)}
      {moreWithAccount && (
        <>
          {' · '}
          <SignInButton>
            <button className="link-btn">Sign in for {limits.account} a day</button>
          </SignInButton>
        </>
      )}{' '}
      · <AiKeyButton>Use your own key</AiKeyButton>
    </p>
  );
}

/** Shown instead of the prompt when AI can't run until the visitor signs in or adds a key. */
export function AiKeyNotice() {
  const { reason, free, signedIn, limits } = useAiStatus();
  const moreWithAccount = !signedIn && limits && limits.account > limits.guest;
  let message: ReactNode;
  if (reason === 'free-used' && free && (free.limit > 0 || moreWithAccount)) {
    const reset = resetsIn(free.resetsAt);
    message = moreWithAccount ? (
      <>
        <strong>You've used your free guest generations.</strong> Sign in to get {limits!.account} a day, or add your own API key
        {reset ? `. More guest generations ${reset}` : ''}.
      </>
    ) : (
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
        key, or one from OpenAI or Vercel AI Gateway.
      </>
    );
  }
  return (
    <div className="ai-notice">
      <p>{message} You can still use templates or write the text yourself.</p>
      <div className="ai-notice-actions">
        {moreWithAccount && (
          <SignInButton>
            <button className="btn btn-primary btn-sm">Sign in</button>
          </SignInButton>
        )}
        <AiKeyButton className={`btn btn-sm ${moreWithAccount ? 'btn-secondary' : 'btn-primary'}`}>Add your API key</AiKeyButton>
      </div>
      {reason === 'no-server-key' && (
        <p className="muted small">
          Running your own copy? Set <code>GEMINI_API_KEY</code> or <code>AI_GATEWAY_API_KEY</code> in <code>server/.env</code> to give
          visitors free generations.
        </p>
      )}
    </div>
  );
}
