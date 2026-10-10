import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ClerkWithRouter from './components/layout/ClerkWithRouter';
import { ToastProvider } from './context/ToastContext';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/index.css';
import './lib/theme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkWithRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ClerkWithRouter>
    </BrowserRouter>
  </StrictMode>
);
