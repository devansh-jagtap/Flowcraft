import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { Link, NavLink } from 'react-router-dom';

function Logo() {
  return (
    <Link to="/" className="logo">
      Flowcraft
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
            Create
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
              <button className="btn btn-primary btn-sm">Sign up</button>
            </SignUpButton>
          </Show>
        </nav>
      </div>
    </header>
  );
}
