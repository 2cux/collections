import { gsap } from 'gsap';
import * as THREE from 'three';

export const INTRO_COPY = { greeting: 'hello!', name: "I'm caobo", finalDescription: '软件工程与 AI 的学习者，正在把问题拆开、验证，再重新组合。', action: 'enter' };
export const INTRO_LAYOUT = { font: 'Arial, "Helvetica Neue", Helvetica, "Noto Sans SC", sans-serif', fontSize: 'clamp(36px, 7.4vw, 46px)', ballRatio: 1.3, bounceRatio: 2.6, rectangleRatio: 2.4, shapeGap: 22, orbSize: 'clamp(76px, 15vw, 92px)', finalGap: 22, pixelRatioCap: 2 };
export const INTRO_TIMING = { reveal: .32, hold: .38, rise: .64, fall: .46, settle: .18, name: .32, rectangleHold: .65, gather: .72, blend: .28, copy: .38, button: .32, exit: .38 };
export const INTRO_EASE = { reveal: 'power2.out', rise: 'power1.out', fall: 'power1.in', settle: 'power1.out', gather: 'power2.inOut', blend: 'none' };
export const INTRO_COLORS = { blue: '#2d8cff', mint: '#50d6b2' };
const seenKey = 'cao-bo-intro-seen', enteredKey = 'cao-bo-site-entered';
const read = key => { try { return sessionStorage.getItem(key) === '1'; } catch { return false; } };
const write = key => { try { sessionStorage.setItem(key, '1'); } catch { /* Storage is optional. */ } };
const mix = (a,b,t) => a+(b-a)*t;

// Reuse Three.js only for the final sphere. No box geometry or morph targets.
function createIntroScene(canvas, onLost) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); } catch { return null; }
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
  camera.position.z = 4;
  renderer.setClearColor(0x11110f, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, INTRO_LAYOUT.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 1024; textureCanvas.height = 512;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#83e8a8'); gradient.addColorStop(.5, '#46d9b6'); gradient.addColorStop(1, '#087883');
  ctx.fillStyle = gradient; ctx.fillRect(0,0,1024,512);
  // SphereGeometry's front-facing UV is u=.25. A narrow face avoids wrapping eyes around the silhouette.
  ctx.fillStyle = '#123d3c';
  for (const x of [228,284]) { ctx.beginPath(); ctx.ellipse(x,231,7,13,0,0,Math.PI*2); ctx.fill(); }
  ctx.strokeStyle = '#123d3c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(256,269,34,25,0,.12,Math.PI-.12); ctx.stroke();
  const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const geometry = new THREE.SphereGeometry(.98,64,48);
  const material = new THREE.MeshStandardMaterial({ map:texture, roughness:.36, metalness:0 });
  scene.add(new THREE.Mesh(geometry,material));
  scene.add(new THREE.HemisphereLight(0xdffff4,0x031e27,.7));
  const key = new THREE.DirectionalLight(0xffffff,2.5); key.position.set(-3,4,5); scene.add(key);
  const resize = () => { const r = canvas.getBoundingClientRect(); renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false); renderer.render(scene,camera); };
  const lost = event => { event.preventDefault(); onLost(); };
  canvas.addEventListener('webglcontextlost',lost);
  resize();
  return { resize, dispose() { canvas.removeEventListener('webglcontextlost',lost); geometry.dispose(); material.dispose(); texture.dispose(); renderer.dispose(); } };
}

export function mountIntro({intro,home,enterButton,homeNavigation,homeVisual,homeFocusTarget}) {
  if (!intro || !home || !enterButton) return () => {};
  const $ = selector => intro.querySelector(selector);
  const hello=$('.intro-hello'), name=$('.intro-name'), text=$('.intro-hero-text'), composition=$('.intro-composition');
  const graphic=$('.intro-graphic-position'), clip=$('.intro-graphic-clip'), pattern=$('.intro-graphic-colorway'), solid=$('.intro-graphic-solid');
  const orb=$('.intro-orb-target'), canvas=$('canvas');
  const copy=$('.intro-final-copy'), skip=$('#skip-intro');
  const query=new URLSearchParams(location.search), freeze=query.get('intro-state');
  const forced=query.has('replay') || ['hello','name','final'].includes(freeze);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion=()=>reduced.matches || (import.meta.env.DEV && query.has('reduced-motion'));
  let disposed=false, entered=false, ready=false, scene=null, attempted=false, tl=null, resizeFrame=0, pendingSkip=false;
  let layout;
  const state={ y:0, morph:0, scale:.08, alpha:0, pattern:0, blend:0, gather:0 };
  intro.style.setProperty('--intro-font',INTRO_LAYOUT.font);
  intro.style.setProperty('--intro-font-size',INTRO_LAYOUT.fontSize);
  intro.style.setProperty('--orb-size',INTRO_LAYOUT.orbSize);
  intro.style.setProperty('--final-gap',`${INTRO_LAYOUT.finalGap}px`);
  intro.querySelectorAll('[data-intro-copy]').forEach(el=>{ el.textContent=INTRO_COPY[el.dataset.introCopy] || ''; });
  function ensureScene() {
    if(attempted) return; attempted=true;
    scene=query.has('no-webgl') ? null : createIntroScene(canvas,()=>{ intro.classList.add('is-webgl-fallback'); });
    intro.classList.toggle('is-webgl-fallback',!scene);
  }
  function measure() {
    const r=composition.getBoundingClientRect(), anchor=text.getBoundingClientRect(), target=orb.getBoundingClientRect();
    const diameter=parseFloat(getComputedStyle(text).fontSize)*INTRO_LAYOUT.ballRatio;
    layout={ x:anchor.left+anchor.width/2-r.left, y:anchor.top+anchor.height/2-r.top, diameter, rest:-(anchor.height/2+INTRO_LAYOUT.shapeGap+diameter/2), apex:-Math.min(diameter*INTRO_LAYOUT.bounceRatio,anchor.top+anchor.height/2-diameter/2-16), finalY:target.top+target.height/2-r.top, finalSize:target.width*.98 };
    graphic.style.width=`${diameter*INTRO_LAYOUT.rectangleRatio}px`;
    scene?.resize();
  }
  function render() {
    const s=layout; if(!s) return;
    gsap.set(graphic,{xPercent:-50,yPercent:-50,x:s.x,y:mix(s.y+state.y,s.finalY,state.gather),scale:state.scale,autoAlpha:state.alpha*(1-state.blend)});
    const width=mix(100,240,state.morph), radius=mix(50,16,state.morph);
    clip.setAttribute('x',(240-width)/2); clip.setAttribute('width',width); clip.setAttribute('rx',radius); clip.setAttribute('ry',radius);
    pattern.style.opacity=state.pattern;
    gsap.set(orb,{autoAlpha:state.blend});
  }
  function finalReady(focus=false) {
    ready=true; intro.dataset.phase='final'; write(seenKey);
    enterButton.disabled=false; enterButton.removeAttribute('aria-hidden');
    if(focus) enterButton.focus({preventScroll:true});
  }
  function showFinal(focus=false) {
    if(!tl) {pendingSkip=true; return;}
    ensureScene(); tl.seek('final',true).pause(); render(); finalReady(focus);
  }
  function enter() {
    if(!ready || entered || disposed) return;
    entered=true; enterButton.disabled=true;
    gsap.set([home,homeNavigation,homeVisual].filter(Boolean),{autoAlpha:1,x:0,y:0});
    if(reduceMotion()) finish(); else tl.play('exit');
  }
  function finish() {
    intro.hidden=true; intro.setAttribute('aria-hidden','true');
    document.documentElement.classList.remove('is-intro-active'); home.removeAttribute('inert');
    gsap.set([home,homeNavigation,homeVisual].filter(Boolean),{autoAlpha:1,x:0,y:0});
    home.classList.add('is-ready'); homeFocusTarget?.focus({preventScroll:true}); write(enteredKey);
    scene?.dispose(); scene=null;
  }
  function build() {
    tl?.kill(); ready=false;
    gsap.set([hello,name,copy,enterButton,orb],{autoAlpha:0,y:0}); gsap.set(intro,{autoAlpha:1});
    gsap.set(hello,{yPercent:100}); gsap.set(name,{yPercent:100});
    gsap.set([copy,enterButton],{y:10}); gsap.set(skip,{autoAlpha:1});
    Object.assign(state,{y:0,morph:0,scale:.08,alpha:0,pattern:0,blend:0,gather:0});
    solid.setAttribute('fill',INTRO_COLORS.blue); measure(); render(); enterButton.disabled=true;
    const t=INTRO_TIMING,e=INTRO_EASE,s=layout;
    // Match velocity at the falling / braking boundary, then arrive at zero speed.
    const brakingDistance=(s.rest-s.apex)*t.settle/(t.fall+t.settle);
    tl=gsap.timeline({paused:true,defaults:{ease:e.reveal},onUpdate:render});
    tl.addLabel('hello',0).to(hello,{autoAlpha:1,yPercent:0,duration:t.reveal},0)
      .addLabel('flight',t.reveal+t.hold)
      .set(state,{alpha:1},'flight')
      .to(state,{scale:1,duration:.16},'flight')
      .to(state,{y:s.apex,duration:t.rise,ease:e.rise},'flight')
      .to(hello,{autoAlpha:0,yPercent:-70,duration:.23},'flight+=0.2')
      .to(name,{autoAlpha:1,yPercent:0,duration:t.name},'flight+=0.4')
      .addLabel('fall',t.reveal+t.hold+t.rise)
      .to(state,{y:s.rest-brakingDistance,duration:t.fall,ease:e.fall},'fall')
      .to(state,{morph:1,pattern:1,duration:t.fall+t.settle,ease:'sine.inOut'},'fall')
      .to(state,{y:s.rest,duration:t.settle,ease:e.settle},`fall+=${t.fall}`)
      .addLabel('name').addLabel('gather',`+=${t.rectangleHold}`)
      .call(ensureScene,[],'gather')
      .to(state,{gather:1,morph:0,pattern:0,scale:s.finalSize/s.diameter,duration:t.gather,ease:e.gather},'gather')
      .to(solid,{attr:{fill:INTRO_COLORS.mint},duration:t.gather},'gather')
      .to(name,{autoAlpha:0,yPercent:-55,duration:t.name},'gather')
      .addLabel('blend').to(state,{blend:1,duration:t.blend,ease:e.blend},'blend')
      .to(copy,{autoAlpha:1,y:0,duration:t.copy},'>')
      .to(enterButton,{autoAlpha:1,y:0,duration:t.button},'>-=0.12')
      .to(skip,{autoAlpha:0,duration:.15},'<')
      .addLabel('final').call(()=>finalReady(),[],'final').addPause('final')
      .addLabel('exit','+=0.001').to(intro,{autoAlpha:0,duration:reduceMotion()?0:t.exit},'exit').call(finish);
    intro.dataset.phase='playing';
  }
  function replay() {
    if(disposed) return;
    entered=false; pendingSkip=false; intro.hidden=false; intro.removeAttribute('aria-hidden');
    document.documentElement.classList.add('is-intro-active'); home.setAttribute('inert','');
    if(!scene) attempted=false;
    build(); if(reduceMotion()) showFinal(); else tl.play(0);
  }
  function onResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame=requestAnimationFrame(()=>{
      if(disposed || entered || !tl) return;
      const time=tl.time(), paused=tl.paused(), wasReady=ready;
      build(); tl.seek(time,true); render(); if(wasReady) finalReady(); if(!paused) tl.play();
    });
  }
  function onSkip(){if(!entered) showFinal(true);}
  function onKey(event) { if(!entered && event.key==='Escape') {event.preventDefault();onSkip();} }
  function onMotion(){if(reduceMotion() && !entered) showFinal();}
  enterButton.addEventListener('click',enter); skip.addEventListener('click',onSkip);
  document.addEventListener('keydown',onKey); window.addEventListener('resize',onResize); reduced.addEventListener('change',onMotion);
  const debug={replay,skip:onSkip};
  let replayButton;
  if(import.meta.env.DEV) {
    window.__intro=debug;
    if(query.has('debug')) {
      replayButton=document.createElement('button'); replayButton.textContent='replay intro';
      replayButton.style.cssText='position:fixed;left:20px;bottom:20px;z-index:20;padding:8px 14px';
      replayButton.addEventListener('click',replay); document.body.append(replayButton);
    }
  }
  if(!forced && read(enteredKey)) {entered=true;finish();}
  else {
    intro.hidden=false; document.documentElement.classList.add('is-intro-active'); home.setAttribute('inert','');
    // Fonts must settle before calculating the actual shared text anchor.
    document.fonts.ready.then(()=>{
      if(disposed || entered) return; build();
      if(pendingSkip || reduceMotion() || (!forced && read(seenKey)) || freeze==='final') showFinal();
      else if(freeze==='hello') tl.seek(INTRO_TIMING.reveal,true).pause();
      else if(freeze==='name') tl.seek('name',true).pause();
      else tl.play(); render();
    });
  }
  return () => {
    disposed=true; cancelAnimationFrame(resizeFrame); tl?.kill(); scene?.dispose();
    enterButton.removeEventListener('click',enter); skip.removeEventListener('click',onSkip);
    document.removeEventListener('keydown',onKey); window.removeEventListener('resize',onResize); reduced.removeEventListener('change',onMotion);
    replayButton?.remove();
    if(window.__intro===debug) delete window.__intro;
    document.documentElement.classList.remove('is-intro-active'); home.removeAttribute('inert');
  };
}
