import { IconContext } from '@phosphor-icons/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ClerkWithRouter from './components/layout/ClerkWithRouter';
import { ToastProvider } from './context/ToastContext';
// Optical sizes switch between text and display cuts by size, like SF Pro Text and Display.
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/geist-mono';
import './styles/index.css';
import './lib/theme';

// One icon family everywhere, at one size and stroke weight.
const ICONS = { size: 16, weight: 'regular' } as const;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <ToastProvider>
          <IconContext.Provider value={ICONS}>
            <App />
          </IconContext.Provider>
        </ToastProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>
);
