import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFoundPage() {
  return (
    <div className="container page">
      <EmptyState icon="🧭" title="Page not found">
        <p className="muted">The page you are looking for doesn't exist.</p>
        <Link to="/" className="btn btn-secondary">
          Back home
        </Link>
      </EmptyState>
    </div>
  );
}
