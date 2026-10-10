import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { Link, NavLink } from 'react-router-dom';

export function Logo() {
  return (
    <Link to="/" className="logo">
      <img src="/favicon.svg" alt="" width={28} height={28} />
      <span>Flowcraft</span>
    </Link>
  );
}

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className="navbar-links">
          <NavLink to="/try" className="nav-link hide-sm">
            ✨ Create
          </NavLink>
          <Show when="signed-in">
            <NavLink to="/app" className="nav-link">
              My diagrams
            </NavLink>
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <button className="nav-link">Log in</button>
            </SignInButton>
            <SignUpButton>
              <button className="btn btn-primary btn-sm">Sign up free</button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
