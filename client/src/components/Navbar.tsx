import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Logo() {
  return (
    <Link to="/" className="logo">
      <img src="/favicon.svg" alt="" width={28} height={28} />
      <span>Flowcraft</span>
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className="navbar-links">
          <NavLink to="/try" className="nav-link hide-sm">
            ✨ Create
          </NavLink>
          {user ? (
            <>
              <NavLink to="/app" className="nav-link">
                My diagrams
              </NavLink>
              <span className="avatar" title={`${user.name} · ${user.email}`}>
                {user.name.charAt(0).toUpperCase()}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="nav-link">
                Log in
              </NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
