# 曹波个人网站入口动画

HTML/SVG 负责二维圆形和彩色圆角矩形，Three.js 只渲染最终笑脸球。一个 GSAP 主时间轴控制开场、交接、欢迎和进入首页。首页文案、导航与锚点保留。

## 运行

```sh
npm install
npm run dev
npm run build
```

## 参数

`src/intro.js` 顶部集中配置：

- `INTRO_COPY`：问候、姓名、真实介绍、按钮文字。项目没有音频，按钮为 enter。
- `INTRO_LAYOUT`：字体栈、36–46px 响应式字号、圆形/字号比例、弹起高度、2.4:1 矩形比例、文字间距、76–92px 球体尺寸和欢迎组间距。
- `INTRO_TIMING`：揭示、停留、上升、下落、落定、矩形停留、收拢、交接、介绍、按钮和离场时间。
- `INTRO_EASE`：各阶段缓动。下落与刹停段依据时长分配距离，以匹配边界速度。
- `INTRO_COLORS`：开场蓝色与交接青绿色。矩形内部几何图案在 `index.html` 的 SVG 中；最终球体材质、表情和光照在 `createIntroScene`。

`src/styles.css` 的 `.intro-composition` / `.intro-hero-text` 控制舞台和统一文字锚点；`.intro-welcome` 使用 flex 内容组居中，间距不依赖视口高度。

## 重播与检查

- `/?replay=1`：忽略访问记录，重新播放。仍尊重系统 reduced-motion。
- `/?intro-state=hello`、`name`、`final`：检查关键构图。
- 开发环境 `window.__intro.replay()` / `window.__intro.skip()`：当前页重播/跳过。
- 开发环境 `/?replay=1&debug=1`：显示重播按钮，可验证从欢迎或首页重复播放。
- `/?replay=1&no-webgl=1`：模拟 WebGL 不可用，完整二维流程后交接 CSS 静态笑脸。
- 开发环境 `&reduced-motion=1`：模拟减少动态效果分支，直接显示欢迎界面。
- skip intro 或 Escape 跳至欢迎；enter 按钮再进入首页。字体加载完成才测量，resize 保留时间轴位置，卸载释放监听器和 WebGL 资源。

## 验证记录

已运行生产构建，并在浏览器连续取帧检查桌面开场、二维形变、停留和交接；检查 390×844 手机布局、600px 宽度、跳过、开发重播、首页入口及模拟无 WebGL / reduced-motion 分支。系统偏好真实切换与真实 GPU context loss 尚未在设备上触发验证。

参考站访问超时，未观察到其完整运动；本次按用户分镜调整，不声称精确复刻原站时间参数。
