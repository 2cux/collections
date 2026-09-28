import "./styles.css";
import { mountIntro } from "./intro.js";
import { mountGallery } from "./gallery.js";
import { mountSpotlightGrid } from "./spotlight-grid.js";

const home = document.querySelector('#home');
const gallery = mountGallery(home.querySelector('.gallery-stage'));
const unmountSpotlightGrid = mountSpotlightGrid({
  host: home,
  layer: home.querySelector('.gallery-grid'),
});
const calibrationMode = new URLSearchParams(location.search).get('spiral-calibration') === '1';
const intro = document.querySelector('#intro');
let unmountIntro;
if (calibrationMode) {
  const stage = home.querySelector('.gallery-stage');
  const grid = home.querySelector('.gallery-grid');
  const controls = home.querySelector('.gallery-views');
  intro.hidden = true;
  intro.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('is-intro-active');
  home.removeAttribute('inert');
  home.style.opacity = '1';
  home.style.transform = 'none';
  stage.style.opacity = '1';
  grid.style.opacity = '1';
  controls.style.opacity = '1';
  gallery.state.reveal = 1;
  gallery.update();
  gallery.enable(true);
  unmountIntro = () => {};
} else {
  unmountIntro = mountIntro({ intro, home, enterButton: document.querySelector('#enter-site'), homeFocusTarget: document.querySelector('.gallery-stage'), gallery });
}
const unmount = () => { unmountIntro(); unmountSpotlightGrid(); gallery.dispose(); };
if (import.meta.hot) import.meta.hot.dispose(unmount);
window.addEventListener('pagehide', event => { if (!event.persisted) unmount(); }, { once: true });
