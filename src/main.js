import "./styles.css";
import { mountIntro } from "./intro.js";
import { mountCharacter } from "./character.js";
import { mountLikes } from "./likes.js";
import { mountActivity } from "./activity.jsx";
import { mountClock } from "./clock.js";
import { mountCalendar } from "./calendar.jsx";
const unmountClock = mountClock();
const unmountCalendar = mountCalendar();
const unmountActivity = mountActivity();
const unmountLikes = mountLikes();
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
  card: document.querySelector('.greeting-home'),
  scene: document.querySelector('#character-page'),
  backButton: document.querySelector('#back-to-greeting'),
  artHost: document.querySelector('#character-art-host'),
});
const emailButton = document.querySelector('#copy-qq-email');
const contactToast = document.querySelector('#contact-toast');
let toastTimer;
let copyingEmail = false;
let disposed = false;
function showContactToast(message) {
  window.clearTimeout(toastTimer);
  contactToast.textContent = message;
  contactToast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => {
    contactToast.classList.remove('is-visible');
    contactToast.textContent = '';
  }, 2800);
}
function copyEmailFallback(email) {
  const input = document.createElement('textarea');
  input.value = email;
  input.readOnly = true;
  input.className = 'clipboard-helper';
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed');
  } finally {
    input.remove();
    emailButton.focus({ preventScroll: true });
  }
}
async function copyQQEmail() {
  if (copyingEmail) return;
  copyingEmail = true;
  const email = 'cb1690015395@qq.com';
  try {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(email); }
      catch { copyEmailFallback(email); }
    } else {
      copyEmailFallback(email);
    }
    if (!disposed) showContactToast('qq邮箱已复制到剪切板');
  } catch {
    if (!disposed) showContactToast('复制失败，请手动复制：' + email);
  } finally {
    copyingEmail = false;
  }
}
emailButton.addEventListener('click', copyQQEmail);
function dispose() {
  disposed = true;
  emailButton.removeEventListener('click', copyQQEmail);
  window.clearTimeout(toastTimer);
  contactToast.classList.remove('is-visible');
  contactToast.textContent = '';
  unmount();
  unmountCharacter();
  unmountLikes();
  unmountActivity();
  unmountClock();
  unmountCalendar();
  window.clearInterval(greetingTimer);
  document.removeEventListener('visibilitychange', updateGreeting);
}
if (import.meta.hot) import.meta.hot.dispose(dispose);
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { once: true });
