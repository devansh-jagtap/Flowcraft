import { Link } from 'react-router-dom';
import type { Diagram } from '../../api/types';
import { TYPE_INFO } from '../../lib/diagram/templates';
import { timeAgo } from '../../lib/format';
import { DiagramThumbnail } from '../diagram/DiagramThumbnail';

interface Props {
  diagram: Diagram;
  onStar: (d: Diagram) => void;
  onDuplicate: (d: Diagram) => void;
  onDelete: (d: Diagram) => void;
}

/** One diagram in the library grid: preview, title, star, and quiet text actions. */
export default function DiagramCard({ diagram: d, onStar, onDuplicate, onDelete }: Props) {
  return (
    <article className="diagram-card">
      <Link to={`/d/${d._id}`} className="diagram-card-preview" aria-label={`Open ${d.title}`}>
        <DiagramThumbnail type={d.type} source={d.source} theme={d.theme} direction={d.direction} />
      </Link>
      <div className="diagram-card-body">
        <div className="diagram-card-title">
          <Link to={`/d/${d._id}`}>
            <h3>{d.title}</h3>
          </Link>
          <button className={`star${d.starred ? ' on' : ''}`} onClick={() => onStar(d)} aria-pressed={d.starred}>
            {d.starred ? 'Starred' : 'Star'}
          </button>
        </div>
        <div className="diagram-card-meta">
          <span>{TYPE_INFO[d.type].label}</span>
          <span>Edited {timeAgo(d.updatedAt)}</span>
          {d.isPublic && <span className="shared-flag">Shared</span>}
        </div>
        <div className="diagram-card-actions">
          <button className="link-btn" onClick={() => onDuplicate(d)}>
            Duplicate
          </button>
          <button className="link-btn danger" onClick={() => onDelete(d)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  );
}

/** Placeholder cards in the same shape as DiagramCard, shown while the library loads. */
export function DiagramCardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="diagram-grid" role="status" aria-label="Loading diagrams">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} aria-hidden>
          <div className="skeleton skeleton-thumb" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}
