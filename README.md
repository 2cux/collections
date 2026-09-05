# 曹波个人网站入口动画

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
- 时长、逐行错峰、缓动与位移在 `src/intro.js` 的 `INTRO_TIMING` 集中配置。
- 开场与首页衔接结构在 `src/intro.js` 的 `mountIntro` 时间轴中维护。
- 同一标签页的展示记录使用 `sessionStorage` 键 `cao-bo-intro-seen`。调试时可在控制台执行 `sessionStorage.removeItem('cao-bo-intro-seen')` 后刷新。
