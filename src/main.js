import "./styles.css";
import { mountIntro } from "./intro.js";
import { mountGallery } from "./gallery.js";

const gallery = mountGallery(document.querySelector('.gallery-stage'));
const unmountIntro = mountIntro({ intro: document.querySelector('#intro'), home: document.querySelector('#home'), enterButton: document.querySelector('#enter-site'), homeFocusTarget: document.querySelector('.gallery-stage'), gallery });
const unmount = () => { unmountIntro(); gallery.dispose(); };
if (import.meta.hot) import.meta.hot.dispose(unmount);
window.addEventListener('pagehide', event => { if (!event.persisted) unmount(); }, { once: true });
