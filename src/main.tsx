import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/context';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    // Renderizamos la App envuelta en el Provider de idioma
    root.render(
        <LocaleProvider>
            <App />
        </LocaleProvider>
    );
}
