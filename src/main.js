import "./styles.css";
import { mountIntro } from "./intro.js";

const unmount = mountIntro({
  intro: document.querySelector("#intro"),
  home: document.querySelector("#home"),
  enterButton: document.querySelector("#enter-site"),
  homeNavigation: document.querySelector(".site-nav"),
  homeVisual: document.querySelector(".hero-section"),
  homeFocusTarget: document.querySelector("[data-home-focus]"),
});
if (import.meta.hot) import.meta.hot.dispose(unmount);
window.addEventListener('pagehide', event => { if (!event.persisted) unmount(); }, { once: true });
