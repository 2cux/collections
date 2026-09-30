import "./styles.css";
import { mountIntro } from "./intro.js";
import { mountCharacter } from "./character.js";
const intro = document.querySelector('#intro');
const greeting = document.querySelector('#greeting-title');
function updateGreeting() {
  const hour = new Date().getHours();
  greeting.textContent = hour >= 5 && hour < 12
    ? 'Good Morning'
    : hour >= 12 && hour < 18 ? 'Good Afternoon' : 'Good Evening';
}
updateGreeting();
const greetingTimer = window.setInterval(updateGreeting, 30_000);
document.addEventListener('visibilitychange', updateGreeting);
const unmount = mountIntro({ intro, enterButton: document.querySelector('#enter-site') });
const unmountCharacter = mountCharacter({
  cardButton: document.querySelector('#open-character'),
  card: document.querySelector('.greeting-card'),
  scene: document.querySelector('#character-page'),
  backButton: document.querySelector('#back-to-greeting'),
  artHost: document.querySelector('#character-art-host'),
});
function dispose() {
  unmount();
  unmountCharacter();
  window.clearInterval(greetingTimer);
  document.removeEventListener('visibilitychange', updateGreeting);
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { once: true });
