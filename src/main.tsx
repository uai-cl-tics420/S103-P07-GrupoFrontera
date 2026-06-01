import React from 'react';
import ReactDOM from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LocaleProvider } from './i18n/context';
import { ToastProvider } from './context/ToastContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    // Renderizamos la App envuelta en el Provider de idioma
    root.render(
        <React.StrictMode>
            <LocaleProvider>
                <ToastProvider>
                    <App />
                </ToastProvider>
            </LocaleProvider>
        </React.StrictMode>
    );
}
