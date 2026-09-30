export const INTRO_VIDEO = { duration: 8.5, buttonStart: 7.02, buttonReveal: .68 };

export function mountIntro({ intro, enterButton }) {
  const video = intro?.querySelector('video');
  if (!video || !enterButton) return () => {};
  const query = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => reduced.matches || (import.meta.env.DEV && query.has('reduced-motion'));
  let disposed = false, entered = false, ready = false, staticFinal = false;
  let timeout, frame, resumeVideo = false;
  let entryAnimations = [];

  function cancelEntry() {
    entryAnimations.forEach(animation => animation.cancel());
    entryAnimations = [];
  }

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#fbf6ed');
    document.activeElement?.blur();
  }
  function enter() {
    if (!ready || entered || disposed) return;
    entered = true; enterButton.disabled = true;
    clearTimeouts(); stopFrames(); video.pause();
    intro.dataset.phase = 'entering';
    intro.setAttribute('inert', '');
    document.activeElement?.blur();
    const minimal = reduceMotion();
    const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';
    const picture = intro.querySelector('.intro-video-frame');
    const pictureAnimation = picture.animate(
      minimal
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.035)' }],
      { duration: minimal ? 160 : 800, easing, fill: 'forwards' },
    );
    const overlayAnimation = intro.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: minimal ? 160 : 1100, delay: minimal ? 0 : 80, easing, fill: 'forwards' },
    );
    entryAnimations = [pictureAnimation, overlayAnimation];
    overlayAnimation.finished.then(() => {
      if (disposed || !entered || !entryAnimations.includes(overlayAnimation)) return;
      finish();
      cancelEntry();
    }).catch(() => {}); // Replay or unmount can cancel an unfinished transition.
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
    if (!entered) showFinal();
    else entryAnimations.forEach(animation => animation.finish());
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
    clearTimeouts(); stopFrames(); cancelEntry();
    entered = false; ready = false; staticFinal = false;
    intro.hidden = false; intro.removeAttribute('aria-hidden');
    intro.removeAttribute('inert');
    intro.classList.remove('is-static-final', 'is-button-ready');
    intro.dataset.phase = 'playing'; intro.dataset.scene = 'welcome';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f7efe1');
    enterButton.disabled = true; enterButton.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.add('is-intro-active');
    video.currentTime = 0;
    if (reduceMotion()) showFinal(); else { waiting(); play(); }
  }
  video.muted = true;
  video.addEventListener('playing', playing); video.addEventListener('timeupdate', syncVideo);
  video.addEventListener('ended', ended); video.addEventListener('error', showFinal);
  video.addEventListener('waiting', waiting);
  enterButton.addEventListener('click', enter);
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', visibility);
  reduced.addEventListener('change', onMotion);
  const debug = { replay, skip: onSkip };
  if (import.meta.env.DEV) window.__intro = debug;

  // Every page load starts a new intro, including reloads in the same tab.
  document.documentElement.classList.add('is-intro-active');
  intro.dataset.phase = 'playing';
  video.currentTime = 0;
  if (reduceMotion() || query.get('intro-state') === 'final') showFinal();
  else { waiting(); play(); }
  return () => {
    disposed = true; clearTimeouts(); stopFrames(); cancelEntry(); video.pause();
    intro.removeAttribute('inert');
    video.removeEventListener('playing', playing); video.removeEventListener('timeupdate', syncVideo);
    video.removeEventListener('ended', ended); video.removeEventListener('error', showFinal);
    video.removeEventListener('waiting', waiting);
    enterButton.removeEventListener('click', enter);
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', visibility);
    reduced.removeEventListener('change', onMotion);
    if (window.__intro === debug) delete window.__intro;
    document.documentElement.classList.remove('is-intro-active');
  };
}
