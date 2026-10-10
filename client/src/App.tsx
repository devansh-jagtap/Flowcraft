import { lazy, Suspense } from 'react';
import { Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { Spinner } from './components/ui';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';

// The canvas-heavy pages are split into their own chunks.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const PlaygroundPage = lazy(() => import('./pages/PlaygroundPage'));
const SharedPage = lazy(() => import('./pages/SharedPage'));

function Layout({ fullHeight = false }: { fullHeight?: boolean }) {
  return (
    <div className={`app${fullHeight ? ' app-full' : ''}`}>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Suspense fallback={<Spinner fullPage />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login/*" element={<AuthPage mode="login" />} />
        <Route path="register/*" element={<AuthPage mode="register" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* App-style pages fill the viewport below the navbar, like a macOS window. */}
      <Route element={<Layout fullHeight />}>
        <Route path="try" element={<PlaygroundPage />} />
        <Route path="s/:shareId" element={<SharedPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="app" element={<DashboardPage />} />
          <Route path="d/:id" element={<EditorPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
