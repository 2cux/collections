import "./styles.css";
import { mountIntro } from "./intro.js";

const home = document.querySelector("#home");

mountIntro({
  intro: document.querySelector("#intro"),
  home,
  enterButton: document.querySelector("#enter-site"),
  homeNavigation: document.querySelector(".site-nav"),
  homeVisual: document.querySelector(".hero-section"),
  homeFocusTarget: document.querySelector("[data-home-focus]"),
});
