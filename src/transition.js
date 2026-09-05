import { gsap } from 'gsap';

export const TRANSITION_TIMING = { press: .1, copy: .36, orb: 1.05, stage: .9, controls: .35, total: 1.55 };

// The same DOM node and WebGL canvas remain alive throughout the flight.
export function createTransition({ intro, home, orb, copy, button, gallery, onComplete }) {
  const destination = home.querySelector('.gallery-brand');
  const stage = home.querySelector('.gallery-stage'), grid = home.querySelector('.gallery-grid');
  const controls = home.querySelector('.gallery-views');
  const parent = orb.parentElement, sibling = orb.nextSibling;
  let timeline, source, target, spacer, detached = false, completed = false;
  const flight = { progress: 0 };
  function measureTarget() { target = destination.getBoundingClientRect(); }
  function position() {
    if (!detached) return;
    const p = flight.progress;
    gsap.set(orb, {
      x: source.left + (target.left - source.left) * p,
      y: source.top + (target.top - source.top) * p,
      scale: 1 + (target.width / source.width - 1) * p,
    });
  }
  function detach() {
    source = orb.getBoundingClientRect(); measureTarget();
    spacer = document.createElement('div');
    spacer.style.cssText = 'flex:none;width:' + source.width + 'px;height:' + source.height + 'px';
    parent.insertBefore(spacer, orb);
    orb.classList.toggle('is-webgl-fallback', intro.classList.contains('is-webgl-fallback'));
    document.body.append(orb); detached = true;
    gsap.set(orb, { position: 'fixed', left: 0, top: 0, width: source.width, height: source.height, zIndex: 12, transformOrigin: '0 0', autoAlpha: 1 });
    position();
  }
  function finish() {
    completed = true; flight.progress = 1; position();
    gallery.state.reveal = 1; gallery.update(); gallery.enable(true);
    gsap.set([stage, grid, controls], { autoAlpha: 1, y: 0 });
    onComplete();
  }
  function start(reduced = false, instant = false) {
    if (detached) return;
    gsap.set(home, { autoAlpha: 1 });
    detach();
    intro.style.background = 'transparent';
    gallery.enable(false);
    if (instant) { finish(); return; }
    const t = TRANSITION_TIMING;
    timeline = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: finish });
    if (reduced) {
      flight.progress = 1; position(); gallery.state.reveal = 1;
      timeline.to([copy, button], { autoAlpha: 0, duration: .15 }, 0)
        .to([stage, grid, controls], { autoAlpha: 1, duration: .2 }, 0);
    } else {
      timeline.to(button, { scale: .96, duration: t.press }, 0)
        .to([copy, button], { y: -18, autoAlpha: 0, duration: t.copy }, .08)
        .to(flight, { progress: 1, duration: t.orb, onUpdate: position }, .12)
        .to(grid, { autoAlpha: 1, duration: .7 }, .15)
        .to(stage, { autoAlpha: 1, duration: t.stage }, .35)
        .to(gallery.state, { reveal: 1, duration: t.stage, onUpdate: gallery.update }, .35)
        .fromTo(controls, { y: -8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: t.controls }, t.total - t.controls);
    }
  }
  function reset() {
    timeline?.kill(); completed = false;
    if (detached) { parent.insertBefore(orb, sibling); spacer?.remove(); detached = false; }
    gsap.set(orb, { clearProps: 'all' }); flight.progress = 0;
    intro.style.removeProperty('background'); gallery.reset();
    gsap.set([stage, grid, controls], { autoAlpha: 0 });
    gsap.set(home, { autoAlpha: 0 });
  }
  function resize() {
    if (!detached) return;
    measureTarget();
    // Preserve current flight progress; destination is always an actual DOM rect.
    position();
  }
  let resume = false;
  function visibility() {
    if (document.hidden) { resume = !!timeline?.isActive(); if (resume) timeline.pause(); }
    else if (resume) { resume = false; timeline?.resume(); }
  }
  function reduce() { if (timeline && !completed) timeline.progress(1); }
  window.addEventListener('resize', resize); document.addEventListener('visibilitychange', visibility);
  return { start, reset, reduce, dispose() { reset(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility); } };
}
