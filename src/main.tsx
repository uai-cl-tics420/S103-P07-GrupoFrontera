import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  // Renderizamos la App directo, sin el "policía" de StrictMode
  root.render(<App />);
}