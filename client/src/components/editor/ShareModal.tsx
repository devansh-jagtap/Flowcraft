import { useState } from 'react';
import { diagramsApi } from '../../api/diagrams';
import type { Diagram } from '../../api/types';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui';

interface Props {
  diagram: Diagram;
  onChange: (diagram: Diagram) => void;
  onClose: () => void;
}

export default function ShareModal({ diagram, onChange, onClose }: Props) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const link = diagram.shareId ? `${window.location.origin}/s/${diagram.shareId}` : '';

  async function toggle() {
    setSaving(true);
    try {
      onChange(await diagramsApi.share(diagram._id, !diagram.isPublic));
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    toast('Link copied to clipboard', 'success');
  }

  return (
    <Modal title="Share diagram" onClose={onClose}>
      <div className="stack">
        <label className="switch-row">
          <div>
            <strong>Anyone with the link can view</strong>
            <p className="muted small">They can view, zoom, download and make their own copy. Only you can edit this one.</p>
          </div>
          <input type="checkbox" className="switch" checked={diagram.isPublic} disabled={saving} onChange={toggle} />
        </label>

        {diagram.isPublic && link && (
          <div className="share-link">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Share link" />
            <button className="btn btn-primary" onClick={copy}>
              Copy
            </button>
          </div>
        )}
        {diagram.isPublic && <p className="muted small">Viewed {diagram.views} times</p>}
      </div>
    </Modal>
  );
}
