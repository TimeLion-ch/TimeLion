import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import favicon from './assets/favicon.png';

// Set from here because Vite never inlines <link rel="icon"> in index.html; imported assets become data: URIs.
const icon = document.createElement('link');
icon.rel = 'icon';
icon.type = 'image/png';
icon.href = favicon;
document.head.append(icon);

const target = document.getElementById('app');
if (target === null) {
	throw new Error('Missing #app element in index.html');
}

mount(App, { target });
