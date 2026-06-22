import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Auto-Zoom beim Fokussieren von Eingabefeldern auf iOS unterbinden
document.addEventListener('gesturestart', e => e.preventDefault());

// Service Worker registrieren (Offline-Fähigkeit / PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.type === 'UPDATE') window.location.reload();
    });
  });
}

const app = mount(App, { target: document.getElementById('app') });

export default app;
