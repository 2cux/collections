import "./styles.css";
import { mountIntro } from "./intro.js";
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
function dispose() {
  unmount();
  window.clearInterval(greetingTimer);
  document.removeEventListener('visibilitychange', updateGreeting);
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { once: true });
