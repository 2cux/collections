import { gsap } from 'gsap';

export const TRANSITION_TIMING = { fade: .65, stage: .8 };

export function createTransition({ intro, home, gallery, onComplete }) {
  const layers = [...home.querySelectorAll('.gallery-stage, .gallery-grid, .gallery-views, .gallery-brand')];
  let timeline, started = false, resume = false;
  function finish() {
    gallery.state.reveal = 1; gallery.update(); gallery.enable(true);
    gsap.set([home, ...layers], { autoAlpha: 1, y: 0 }); onComplete();
  }
  function start(reduced = false, instant = false) {
    if (started) return;
    started = true; gallery.enable(false); gsap.set(home, { autoAlpha: 1 });
    if (instant) { finish(); return; }
    const duration = reduced ? .15 : TRANSITION_TIMING.stage;
    timeline = gsap.timeline({ defaults: { ease: 'sine.inOut' }, onComplete: finish });
    timeline.to(intro, { autoAlpha: 0, duration: reduced ? .15 : TRANSITION_TIMING.fade }, 0)
      .to(layers, { autoAlpha: 1, duration }, 0)
      .to(gallery.state, { reveal: 1, duration, onUpdate: gallery.update }, 0);
  }
  function reset() {
    timeline?.kill(); timeline = null; started = false; resume = false;
    gallery.reset(); home.classList.remove('is-ready');
    gsap.set([home, ...layers], { autoAlpha: 0, y: 0 }); gsap.set(intro, { autoAlpha: 1 });
  }
  function visibility() {
    if (document.hidden) { resume = !!timeline?.isActive(); if (resume) timeline.pause(); }
    else if (resume) { resume = false; timeline?.resume(); }
  }
  document.addEventListener('visibilitychange', visibility);
  return {
    start, reset,
    reduce() { timeline?.progress(1); },
    dispose() { timeline?.kill(); document.removeEventListener('visibilitychange', visibility); },
  };
}
