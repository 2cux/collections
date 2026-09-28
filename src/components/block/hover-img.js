import { gsap } from 'gsap';
import './hover-img.css';

/** @typedef {{ title: string, label: string, imageSrc: string }} HoverProject */
/**
 * Framework-neutral ObsidianUI Hover Image pattern.
 * @param {HTMLElement} container
 * @param {{ projects: HoverProject[], className?: string, isContained?: boolean, compact?: boolean }} props
 */
export function mountHoverImg(container, { projects = [], className = '', isContained = false, compact = false } = {}) {
  if (!(container instanceof HTMLElement)) return () => {};
  const safeProjects = projects.filter(project => project && typeof project.title === 'string' && typeof project.imageSrc === 'string');
  const root = document.createElement('section');
  root.className = ['hover-img-container', className, isContained && 'is-contained', compact && 'hover-img-compact'].filter(Boolean).join(' ');
  root.setAttribute('aria-label', '项目预览');
  const list = document.createElement('div'); list.className = 'hover-img-projects'; list.setAttribute('role', 'list');
  const thumbnail = document.createElement('div'); thumbnail.className = 'hover-img-thumbnail-wrapper'; thumbnail.setAttribute('aria-hidden', 'true');
  const layers = safeProjects.map((project, index) => {
    const image = document.createElement('img');
    image.className = 'hover-img-thumbnail'; image.src = project.imageSrc; image.alt = project.title; image.decoding = 'async'; image.loading = index === 0 ? 'eager' : 'lazy';
    thumbnail.append(image); return image;
  });
  safeProjects.forEach((project, index) => {
    const item = document.createElement('button');
    item.className = 'hover-img-project'; item.type = 'button'; item.dataset.index = String(index); item.setAttribute('role', 'listitem');
    const title = document.createElement('h2'); title.textContent = project.title;
    const label = document.createElement('p'); label.textContent = project.label;
    item.append(title, label); list.append(item);
  });
  root.append(list, thumbnail); container.replaceChildren(root);
  const items = [...list.querySelectorAll('.hover-img-project')];
  gsap.set(thumbnail, { scale: 0, xPercent: -50, yPercent: -50 });
  const xTo = gsap.quickTo(thumbnail, 'x', { duration: 0.4, ease: 'power3.out' });
  const yTo = gsap.quickTo(thumbnail, 'y', { duration: 0.4, ease: 'power3.out' });
  let activeIndex = -1;
  const move = event => {
    let x = event.clientX, y = event.clientY;
    if (isContained) {
      const rootRect = root.getBoundingClientRect();
      x = event.clientX - rootRect.left;
      y = event.clientY - rootRect.top;
    }
    xTo(x); yTo(y);
  };
  const show = (index, event) => {
    if (!Number.isInteger(index) || !layers[index]) return;
    move(event);
    if (activeIndex !== index) {
      activeIndex = index; items.forEach((item, itemIndex) => item.classList.toggle('is-active', itemIndex === index));
      gsap.to(layers, { yPercent: -100 * index, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
    }
    gsap.to(thumbnail, { scale: 1, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
  };
  const hide = () => { activeIndex = -1; items.forEach(item => item.classList.remove('is-active')); gsap.to(thumbnail, { scale: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }); };
  const onOver = event => show(Number(event.currentTarget.dataset.index), event);
  const onFocus = event => { const rect = event.currentTarget.getBoundingClientRect(); show(Number(event.currentTarget.dataset.index), { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }); };
  items.forEach(item => { item.addEventListener('pointerenter', onOver); item.addEventListener('focus', onFocus); });
  list.addEventListener('pointermove', move, { passive: true });
  list.addEventListener('pointerleave', hide);
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) hide(); });
  return () => { items.forEach(item => { item.removeEventListener('pointerenter', onOver); item.removeEventListener('focus', onFocus); }); list.removeEventListener('pointermove', move); list.removeEventListener('pointerleave', hide); gsap.killTweensOf([thumbnail, ...layers]); xTo.tween.kill(); yTo.tween.kill(); root.remove(); };
}
