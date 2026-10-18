import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { Key, PencilSimpleLine, SquaresFour } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import AppearanceMenu from './AppearanceMenu';

/** Three connected steps: the product in one glyph. */
function LogoMark() {
  return (
    <svg className="logo-mark" viewBox="0 0 28 28" aria-hidden>
      <rect width="28" height="28" rx="8" />
      <path d="M9 9.5h10M9 9.5v9h10" fill="none" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="9.5" r="2.6" />
      <circle cx="19" cy="9.5" r="2.6" />
      <circle cx="19" cy="18.5" r="2.6" />
    </svg>
  );
}

function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Flowcraft home">
      <LogoMark />
      <span>Flowcraft</span>
    </Link>
  );
}

/** Transparent over the landing hero; frosted once the page scrolls under it. */
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  return scrolled;
}

// Labels in .nav-label collapse to icon-only buttons on phones (still read by screen readers).
export default function Navbar() {
  const { pathname } = useLocation();
  const landing = pathname === '/';
  const scrolled = useScrolled();

  return (
    <header className={`navbar${landing ? ' navbar-landing' : ''}${landing && !scrolled ? ' is-top' : ''}`}>
      <div className="container navbar-inner">
        <Logo />

        {landing && (
          <nav className="navbar-center" aria-label="Sections">
            <Link to="/try">Editor</Link>
            <a href="#types">Diagram types</a>
            <a href="#how">How it works</a>
            <Link to="/ai">AI keys</Link>
          </nav>
        )}

        <nav className="navbar-links" aria-label="Account">
          {!landing && (
            <>
              <NavLink to="/try" className="nav-btn">
                <PencilSimpleLine aria-hidden />
                <span className="nav-label">Editor</span>
              </NavLink>
              <Show when="signed-in">
                <NavLink to="/app" className="nav-btn">
                  <SquaresFour aria-hidden />
                  <span className="nav-label">My diagrams</span>
                </NavLink>
              </Show>
              <NavLink to="/ai" className="nav-btn">
                <Key aria-hidden />
                <span className="nav-label">AI keys</span>
              </NavLink>
            </>
          )}
          {landing && (
            <Show when="signed-in">
              <NavLink to="/app" className="nav-btn">
                <SquaresFour aria-hidden />
                <span className="nav-label">My diagrams</span>
              </NavLink>
            </Show>
          )}
          <AppearanceMenu />
          <Show when="signed-in">
            <span className="nav-user">
              <UserButton />
            </span>
          </Show>
          <Show when="signed-out">
            <SignInButton>
              <button className="nav-btn nav-btn-text">Log in</button>
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
