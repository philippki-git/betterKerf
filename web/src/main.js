import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// Auto-Zoom beim Fokussieren von Eingabefeldern auf iOS unterbinden
document.addEventListener('gesturestart', e => e.preventDefault());

const app = mount(App, { target: document.getElementById('app') });

export default app;
