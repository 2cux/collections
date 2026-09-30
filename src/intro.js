import { createTransition } from './transition.js';

export const INTRO_VIDEO = { duration: 8.5, buttonStart: 7.02, buttonReveal: .68 };

export function mountIntro({ intro, home, enterButton, homeFocusTarget, gallery }) {
  const video = intro?.querySelector('video');
  if (!video || !home || !enterButton) return () => {};
  const skip = intro.querySelector('#skip-intro'), query = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => reduced.matches || (import.meta.env.DEV && query.has('reduced-motion'));
  let disposed = false, entered = false, ready = false, staticFinal = false;
  let timeout, frame, resumeVideo = false;
  const transition = createTransition({ intro, home, gallery, onComplete: finish });

  function clearTimeouts() { clearTimeout(timeout); }
  function stopFrames() {
    if (frame == null) return;
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frame);
    else cancelAnimationFrame(frame);
    frame = null;
  }
  function makeReady(focus = false, progress = 1) {
    ready = true; intro.classList.add('is-button-ready');
    intro.style.setProperty('--enter-progress', progress);
    enterButton.disabled = false; enterButton.removeAttribute('aria-hidden');
    if (focus) enterButton.focus({ preventScroll: true });
  }
  function syncVideo() {
    if (disposed || entered || staticFinal) return;
    const time = video.currentTime;
    intro.dataset.scene = time < 2.47 ? 'welcome' : time < 5.30 ? 'name' : 'website';
    if (time >= INTRO_VIDEO.buttonStart) {
      const progress = Math.min(1, (time - INTRO_VIDEO.buttonStart) / INTRO_VIDEO.buttonReveal);
      makeReady(false, 1 - (1 - progress) ** 3);
    }
  }
  function tick() {
    syncVideo();
    if (!disposed && !entered && !staticFinal && !video.paused && !video.ended) {
      frame = video.requestVideoFrameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick);
    } else frame = null;
  }
  function showFinal(focus = false) {
    if (disposed || entered) return;
    staticFinal = true; clearTimeouts(); stopFrames(); video.pause();
    intro.classList.add('is-static-final');
    intro.dataset.scene = 'website'; intro.dataset.phase = 'final';
    makeReady(focus === true);
  }
  function ended() {
    clearTimeouts(); stopFrames(); intro.dataset.phase = 'final';
    syncVideo(); makeReady();
    // Keep the decoded last frame visible; do not rewind or loop.
  }
  function finish() {
    intro.hidden = true; intro.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('is-intro-active');
    home.removeAttribute('inert'); home.classList.add('is-ready');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#11110f');
    homeFocusTarget?.focus({ preventScroll: true });
  }
  function enter() {
    if (!ready || entered || disposed) return;
    entered = true; enterButton.disabled = true;
    clearTimeouts(); stopFrames(); video.pause(); transition.start(reduceMotion());
  }
  function play() {
    if (disposed || entered || staticFinal) return;
    video.play().catch(() => showFinal());
  }
  function playing() {
    if (disposed || entered || staticFinal) { video.pause(); return; }
    clearTimeouts(); stopFrames(); tick();
  }
  function waiting() {
    clearTimeouts();
    timeout = setTimeout(() => { if (!document.hidden) showFinal(); }, 5000);
  }
  function onSkip() { showFinal(true); }
  function onKey(event) {
    if (!entered && event.key === 'Escape') { event.preventDefault(); onSkip(); }
  }
  function onMotion() {
    if (!reduceMotion()) return;
    if (!entered) showFinal(); else transition.reduce();
  }
  function visibility() {
    if (document.hidden) {
      resumeVideo = !entered && !staticFinal && !video.paused;
      if (resumeVideo) video.pause();
      clearTimeouts(); stopFrames();
    } else if (resumeVideo) { resumeVideo = false; play(); }
  }
  function replay() {
    if (disposed) return;
    clearTimeouts(); stopFrames(); transition.reset();
    entered = false; ready = false; staticFinal = false;
    intro.hidden = false; intro.removeAttribute('aria-hidden');
    intro.classList.remove('is-static-final', 'is-button-ready');
    intro.dataset.phase = 'playing'; intro.dataset.scene = 'welcome';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7efe1');
    enterButton.disabled = true; enterButton.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.add('is-intro-active'); home.setAttribute('inert', '');
    video.currentTime = 0;
    if (reduceMotion()) showFinal(); else { waiting(); play(); }
  }
  video.muted = true;
  video.addEventListener('playing', playing); video.addEventListener('timeupdate', syncVideo);
  video.addEventListener('ended', ended); video.addEventListener('error', showFinal);
  video.addEventListener('waiting', waiting);
  enterButton.addEventListener('click', enter); skip.addEventListener('click', onSkip);
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', onMotion);
  const debug = { replay, skip: onSkip };
  if (import.meta.env.DEV) window.__intro = debug;

  // Every page load starts a new intro, including reloads in the same tab.
  document.documentElement.classList.add('is-intro-active'); home.setAttribute('inert', '');
  intro.dataset.phase = 'playing';
  video.currentTime = 0;
  if (reduceMotion() || query.get('intro-state') === 'final') showFinal();
  else { waiting(); play(); }
  return () => {
    disposed = true; clearTimeouts(); stopFrames(); video.pause(); transition.dispose();
    video.removeEventListener('playing', playing); video.removeEventListener('timeupdate', syncVideo);
    video.removeEventListener('ended', ended); video.removeEventListener('error', showFinal);
    video.removeEventListener('waiting', waiting);
    enterButton.removeEventListener('click', enter); skip.removeEventListener('click', onSkip);
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', onMotion);
    if (window.__intro === debug) delete window.__intro;
    document.documentElement.classList.remove('is-intro-active'); home.removeAttribute('inert');
  };
}
