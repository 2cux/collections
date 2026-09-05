# 曹波个人网站入口动画

入口由 GSAP 单一主时间轴编排，Three.js 负责球体/长方体的连续顶点形变，HTML/CSS 负责语义化文案和进入按钮。首页内容和锚点导航保持不变。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 调整入口动画

- 文案在 `src/intro.js` 顶部的 `INTRO_COPY` 集中配置。
- 时长在 `INTRO_TIMING`，相机、球/盒尺寸、轨迹高度、像素比与几何细分在 `INTRO_LAYOUT`，颜色在 `INTRO_COLORS`。
- 开场、飞行、形变、笑脸交接和首页衔接都在 `mountIntro` 的同一条主时间轴中维护。
- 首次播放后按 `sessionStorage` 记录；已进入首页的同一标签页刷新不会重复播放开场。开发时可用 `/?replay=1` 强制重播完整动画。
- 用户可点击 `skip intro` 或按 `Escape` 跳到最终欢迎界面；按钮仍保留，点击后才进入首页。
- `prefers-reduced-motion` 会直接展示最终欢迎界面；WebGL 不可用时使用静态 CSS 笑脸球体并保留进入行为。
