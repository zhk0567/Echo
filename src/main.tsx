import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyFontSizePreference } from './lib/preferences';
import './styles/app.css';

applyFontSizePreference();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
