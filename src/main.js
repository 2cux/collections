import "./styles.css";
import { mountIntro } from "./intro.js";
const intro = document.querySelector('#intro');
const unmount = mountIntro({ intro, enterButton: document.querySelector('#enter-site') });
if (import.meta.hot) import.meta.hot.dispose(unmount);
window.addEventListener('pagehide', event => { if (!event.persisted) unmount(); }, { once: true });
