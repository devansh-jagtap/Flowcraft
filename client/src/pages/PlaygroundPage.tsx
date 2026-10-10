import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import type { DiagramDraft } from '../api/types';
import Workspace from '../components/Workspace';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { guestDraft, pendingImport } from '../lib/draft';
import { TEMPLATES } from '../lib/diagram/templates';

function initialDraft(templateId: string | null): DiagramDraft {
  const template = TEMPLATES.find((t) => t.id === templateId);
  if (template) {
    const { name, type, source, theme, direction } = template;
    return { title: name, type, source, theme, direction, positions: {} };
  }
  const saved = guestDraft.load();
  if (saved) return saved;

  const { name, type, source, theme, direction } = TEMPLATES[0];
  return { title: name, type, source, theme, direction, positions: {} };
}

/** Try the editor without an account. Work is kept in localStorage until the user saves it. */
export default function PlaygroundPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [draft, setDraft] = useState(() => initialDraft(params.get('template')));
  const [saving, setSaving] = useState(false);

  useEffect(() => guestDraft.save(draft), [draft]);

  async function saveToAccount() {
    if (!user) {
      pendingImport.mark();
      navigate('/register', { state: { from: '/app' } });
      return;
    }
    setSaving(true);
    try {
      const diagram = await diagramsApi.create(draft);
      guestDraft.clear();
      toast('Saved to your diagrams', 'success');
      navigate(`/d/${diagram._id}`);
    } catch (err) {
      toast((err as Error).message, 'error');
      setSaving(false);
    }
  }

  return (
    <Workspace
      draft={draft}
      onChange={(changes) => setDraft((d) => ({ ...d, ...changes }))}
      status={user ? 'Not saved yet' : 'Playground · saved in this browser'}
      actions={
        <button className="btn btn-primary btn-sm" onClick={saveToAccount} disabled={saving}>
          {user ? 'Save to my diagrams' : 'Sign up to save'}
        </button>
      }
    />
  );
}
