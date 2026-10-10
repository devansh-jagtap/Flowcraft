import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui';

export default function ProtectedRoute() {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner fullPage />;
  // Clerk sends the user back to redirect_url once they've signed in.
  if (!user) return <Navigate to={`/login?redirect_url=${encodeURIComponent(location.pathname)}`} replace />;
  return <Outlet />;
}
