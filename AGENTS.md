# Typography

- All Chinese and English UI text must use the greeting card's shared handwriting style, including headings, body text, dates, numbers, buttons, and form controls.
- Use `var(--font-handwritten)` from `src/styles.css`; `--font-body` is an alias for the same family. New components should inherit this font by default.
- Preserve the greeting card's Segoe Print / Bradley Hand / Chalkboard SE Latin font stack and the KaiTi / STKaiti Chinese fallbacks. Do not introduce separate Arial, Microsoft YaHei, or other font families unless the user explicitly requests a change.
- Fonts embedded in existing image or video assets require editing the source asset; CSS only controls live UI text.
