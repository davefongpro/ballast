import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import './styles/base.css';
import App from './App.tsx';

/**
 * Page-view counting only.
 *
 * This records that a page was viewed, where the visitor arrived from, and their
 * country and device class. It never sees the contents of anyone's work — the
 * ideas, the scores, the measures and the notes stay in the browser and are
 * never sent anywhere. `/privacy.html` says the same thing in the same words,
 * and the two must not be allowed to disagree.
 */
inject({ mode: import.meta.env.PROD ? 'production' : 'development' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
