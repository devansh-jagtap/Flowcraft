import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { PencilSimpleLine, SignIn, SquaresFour } from '@phosphor-icons/react';
import { Link, NavLink } from 'react-router-dom';
import AppearanceMenu from './AppearanceMenu';

function Logo() {
  return (
    <Link to="/" className="logo">
      Flowcraft
    </Link>
  );
}

// Labels in .nav-label collapse to icon-only buttons on phones (still read by screen readers).
export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className="navbar-links">
          <NavLink to="/try" className="nav-btn">
            <PencilSimpleLine aria-hidden />
            <span className="nav-label">Open editor</span>
          </NavLink>
          <Show when="signed-in">
            <NavLink to="/app" className="nav-btn">
              <SquaresFour aria-hidden />
              <span className="nav-label">My diagrams</span>
            </NavLink>
          </Show>
          <AppearanceMenu />
          <Show when="signed-in">
            <UserButton />
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <button className="nav-btn">
                <SignIn aria-hidden />
                <span className="nav-label">Log in</span>
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="nav-btn nav-btn-primary">Sign up</button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
