import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { PresentRoute } from './Present.js';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode>{location.pathname.startsWith('/present') ? <PresentRoute /> : <App />}</StrictMode>);
