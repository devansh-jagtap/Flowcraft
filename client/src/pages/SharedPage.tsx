import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { diagramsApi } from '../api/diagrams';
import DiagramCanvas from '../components/diagram/DiagramCanvas';
import { EmptyState, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { guestDraft } from '../lib/draft';
import { parseDiagram } from '../lib/diagram/parse';
import { TYPE_INFO } from '../lib/diagram/templates';
import { timeAgo } from '../lib/format';

export default function SharedPage() {
  const { shareId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [copying, setCopying] = useState(false);
  const { data: diagram, error, loading } = useAsync((signal) => diagramsApi.getShared(shareId, signal), [shareId]);

  const graph = useMemo(() => (diagram ? parseDiagram(diagram.type, diagram.source) : null), [diagram]);

  if (loading) return <Spinner fullPage />;
  if (error || !diagram || !graph) {
    return (
      <div className="container page">
        <EmptyState icon="🔒" title="This diagram isn't available">
          <p className="muted">{error?.message ?? 'It may be private or deleted.'}</p>
          <Link to="/try" className="btn btn-primary">
            Make your own diagram
          </Link>
        </EmptyState>
      </div>
    );
  }

  async function makeCopy() {
    if (!diagram) return;
    if (!user) {
      // Guests get the diagram in the playground straight away.
      guestDraft.save({ ...diagram, positions: diagram.positions ?? {}, prompts: diagram.prompts ?? [] });
      navigate('/try');
      return;
    }
    setCopying(true);
    try {
      const copy = await diagramsApi.fork(shareId);
      toast('Copied to your diagrams', 'success');
      navigate(`/d/${copy._id}`);
    } catch (err) {
      toast((err as Error).message, 'error');
      setCopying(false);
    }
  }

  return (
    <div className="shared-page">
      <div className="toolbar">
        <div>
          <h1 className="shared-title">{diagram.title}</h1>
          <p className="muted small">
            {TYPE_INFO[diagram.type].icon} {TYPE_INFO[diagram.type].label} by <strong>{diagram.author}</strong> · updated{' '}
            {timeAgo(diagram.updatedAt)} · {diagram.views} views
          </p>
        </div>
        <div className="toolbar-group toolbar-end">
          <button className="btn btn-primary btn-sm" onClick={makeCopy} disabled={copying}>
            ✎ Make a copy to edit
          </button>
        </div>
      </div>
      <div className="shared-canvas">
        <DiagramCanvas
          graph={graph}
          type={diagram.type}
          direction={diagram.direction}
          theme={diagram.theme}
          positions={diagram.positions}
          exportName={diagram.title}
          showMiniMap
        />
      </div>
    </div>
  );
}
