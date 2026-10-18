import { SignInButton, SignUpButton } from '@clerk/react';
import { ChartBar, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { aiApi, useUsageVersion, type AiUsage } from '../api/ai';
import { AiKeysPanel } from '../components/ai/AiKey';
import { ErrorState, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useAiStatus } from '../hooks/useAiEnabled';
import { PROVIDERS } from '../lib/aiKey';
import { timeAgo } from '../lib/format';
import { freeSummary, resetsIn } from '../lib/freeUsage';

const number = new Intl.NumberFormat('en');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const CHART_DAYS = 14;

const ERROR_LABELS: Record<string, string> = {
  AI_KEY_INVALID: 'Key rejected',
  AI_FREE_LIMIT: 'Free limit reached',
  HTTP_429: 'Rate limited',
  HTTP_502: 'Provider error',
  HTTP_504: 'Timed out',
  HTTP_400: 'Request blocked',
};

const providerLabel = (provider: string) => PROVIDERS[provider as keyof typeof PROVIDERS]?.label ?? provider;

/** AI keys and usage: which key draws diagrams, each provider's key, and what has been used. */
export default function AiSettingsPage() {
  const { user, ready } = useAuth();
  const usageVersion = useUsageVersion();
  // Usage history belongs to an account, so guests never request it.
  const usage = useAsync((signal) => (user ? aiApi.usage(signal) : Promise.resolve(null)), [usageVersion, user?.id]);

  return (
    <div className="page container ai-page">
      <header className="page-head">
        <p className="eyebrow">AI</p>
        <h1>Keys and usage</h1>
        <p className="muted">
          Choose what draws your diagrams, manage your own API keys, and see how much you've used in the last 30 days.
        </p>
      </header>

      <CurrentSource />
      <AiKeysPanel />

      <section className="usage-section" aria-labelledby="usage-title">
        <div className="usage-head">
          <h2 id="usage-title">Usage</h2>
          {user && <span className="muted small">Last {usage.data?.windowDays ?? 30} days</span>}
        </div>
        {!ready ? (
          <Spinner />
        ) : !user ? (
          <SignedOutUsage />
        ) : usage.error ? (
          <ErrorState error={usage.error} onRetry={usage.reload} />
        ) : !usage.data ? (
          <Spinner />
        ) : (
          <UsageReport usage={usage.data} />
        )}
      </section>
    </div>
  );
}

/** A one-line summary of what the next generation will use. */
function CurrentSource() {
  const { ownKey, free, freeTier } = useAiStatus();
  let text: string;
  if (ownKey) text = `Your ${PROVIDERS[ownKey.provider].label} key · ${ownKey.model || PROVIDERS[ownKey.provider].defaultModel}`;
  else if (freeTier && free) text = `Free generations · ${freeSummary(free)}`;
  else text = 'Nothing yet: add an API key below';
  const ok = Boolean(ownKey) || (free?.remaining ?? 0) > 0;

  return (
    <div className={`current-source${ok ? '' : ' is-blocked'}`} role="status">
      {ok ? <CheckCircle weight="fill" aria-hidden /> : <WarningCircle weight="fill" aria-hidden />}
      <span>
        <strong>New diagrams use:</strong> {text}
      </span>
      <Link to="/try" className="btn btn-secondary btn-sm">
        Open editor
      </Link>
    </div>
  );
}

function UsageReport({ usage }: { usage: AiUsage }) {
  const generations = usage.byModel.reduce((n, r) => n + r.generations, 0);
  const failed = usage.byModel.reduce((n, r) => n + r.failed, 0);
  const inputTokens = usage.byModel.reduce((n, r) => n + r.inputTokens, 0);
  const outputTokens = usage.byModel.reduce((n, r) => n + r.outputTokens, 0);

  return (
    <>
      <div className="stat-tiles">
        <StatTile label="Generations" value={number.format(generations)} detail={failed ? `${failed} failed` : 'none failed'} />
        <StatTile
          label="Tokens"
          value={compact.format(inputTokens + outputTokens)}
          detail={`${compact.format(inputTokens)} in · ${compact.format(outputTokens)} out`}
        />
        <StatTile
          label="Free generations left"
          value={usage.free ? `${usage.free.remaining} / ${usage.free.limit}` : '–'}
          detail={
            !usage.freeTier
              ? 'Not offered on this site'
              : usage.free?.resetsAt
                ? `Resets ${resetsIn(usage.free.resetsAt)}`
                : `On ${usage.freeTier.label} ${usage.freeTier.model}`
          }
        />
        <StatTile
          label="Success rate"
          value={generations ? `${Math.round(((generations - failed) / generations) * 100)}%` : '–'}
          detail={generations ? 'of AI requests' : 'No requests yet'}
        />
      </div>

      {generations === 0 ? (
        <div className="usage-empty">
          <p>
            <strong>No AI usage yet.</strong> Generate a diagram and it shows up here, with the tokens each provider and model used.
          </p>
        </div>
      ) : (
        <>
          <DailyChart daily={usage.daily} />
          <ModelTable usage={usage} />
          <RecentActivity usage={usage} />
        </>
      )}

    </>
  );
}

/** Guests see an invitation instead: their usage isn't recorded, since many people can share one address. */
function SignedOutUsage() {
  return (
    <div className="usage-signed-out">
      <ChartBar aria-hidden />
      <div>
        <h3>Sign in to see your usage</h3>
        <p className="muted">
          Your account keeps a private history of your AI generations: tokens per provider and model, a daily chart and recent activity.
          Usage isn't recorded while you're signed out.
        </p>
      </div>
      <div className="usage-signed-out-actions">
        <SignInButton>
          <button className="btn btn-secondary">Log in</button>
        </SignInButton>
        <SignUpButton>
          <button className="btn btn-primary">Sign up</button>
        </SignUpButton>
      </div>
    </div>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-detail">{detail}</span>
    </div>
  );
}

/** The last 14 days, oldest first, with days that had no requests filled in as zero. */
function lastDays(daily: AiUsage['daily']) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  return Array.from({ length: CHART_DAYS }, (_, i) => {
    const date = new Date(Date.now() - (CHART_DAYS - 1 - i) * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    return { day, date, generations: byDay.get(day)?.generations ?? 0, tokens: byDay.get(day)?.tokens ?? 0 };
  });
}

const dayLabel = (date: Date) => date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function DailyChart({ daily }: { daily: AiUsage['daily'] }) {
  const days = lastDays(daily);
  const max = Math.max(1, ...days.map((d) => d.generations));
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered === null ? null : days[hovered];

  return (
    <figure className="usage-card daily-chart">
      <figcaption>
        <h3>Generations per day</h3>
        <span className="muted small" aria-live="polite">
          {shown
            ? `${dayLabel(shown.date)}: ${shown.generations} generation${shown.generations === 1 ? '' : 's'}, ${number.format(shown.tokens)} tokens`
            : `Last ${CHART_DAYS} days, UTC`}
        </span>
      </figcaption>
      <div className="bars" onMouseLeave={() => setHovered(null)}>
        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className={`bar-slot${hovered === i ? ' is-hovered' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            aria-label={`${dayLabel(d.date)}: ${d.generations} generations, ${d.tokens} tokens`}
          >
            <span className="bar" style={{ height: d.generations ? `${Math.max(4, (d.generations / max) * 100)}%` : 0 }} />
          </button>
        ))}
      </div>
      <div className="bar-axis muted small" aria-hidden>
        <span>{dayLabel(days[0].date)}</span>
        <span>Today</span>
      </div>
      <details className="table-view">
        <summary className="small">Show as table</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Generations</th>
              <th className="num">Tokens</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td>{dayLabel(d.date)}</td>
                <td className="num">{d.generations}</td>
                <td className="num">{number.format(d.tokens)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function ModelTable({ usage }: { usage: AiUsage }) {
  return (
    <section className="usage-card">
      <h3>By provider and model</h3>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>Key</th>
              <th className="num">Generations</th>
              <th className="num">Failed</th>
              <th className="num">Tokens in</th>
              <th className="num">Tokens out</th>
              <th>Last used</th>
            </tr>
          </thead>
          <tbody>
            {usage.byModel.map((row) => (
              <tr key={`${row.source}-${row.provider}-${row.model}`}>
                <td>{providerLabel(row.provider)}</td>
                <td className="mono">{row.model}</td>
                <td>
                  <span className={`badge${row.source === 'own' ? ' badge-primary' : ''}`}>{row.source === 'own' ? 'Your key' : 'Free'}</span>
                </td>
                <td className="num">{number.format(row.generations)}</td>
                <td className="num">{row.failed ? number.format(row.failed) : '–'}</td>
                <td className="num">{number.format(row.inputTokens)}</td>
                <td className="num">{number.format(row.outputTokens)}</td>
                <td className="muted">{timeAgo(row.lastUsedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecentActivity({ usage }: { usage: AiUsage }) {
  return (
    <section className="usage-card">
      <h3>Recent activity</h3>
      <ol className="activity">
        {usage.recent.map((event) => (
          <li key={event.id} className={event.ok ? '' : 'is-failed'}>
            <span className="activity-status" aria-hidden>
              {event.ok ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
            </span>
            <div className="activity-main">
              <span className="activity-title">
                {event.prompt ?? (event.ok ? 'Diagram generated' : 'Generation failed')}
                {!event.ok && <span className="badge badge-danger">{ERROR_LABELS[event.errorCode ?? ''] ?? event.errorCode ?? 'Failed'}</span>}
              </span>
              <span className="muted small">
                {providerLabel(event.provider)} · <span className="mono">{event.model}</span> · {event.source === 'own' ? 'your key' : 'free'}
              </span>
            </div>
            <div className="activity-meta muted small">
              <span>{number.format(event.inputTokens + event.outputTokens)} tokens</span>
              <span>{(event.durationMs / 1000).toFixed(1)} s</span>
              <time dateTime={event.createdAt}>{timeAgo(event.createdAt)}</time>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
