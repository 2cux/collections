# 曹波个人网站

沿用 Vite、GSAP 和 Three.js。原 hello!、弹球、二维矩形和 I'm caobo 时间轴保留；欢迎到螺旋页由独立时间轴控制。真实作品可以通过 `src/projects.js` 接入，当前空数组继续使用确定性的 placeholder。

## 运行

```sh
npm run dev
npm run build
```

## 调整位置

- `src/projects.js`：真实作品数组 `projects`。每项支持 `{ id, title, cover, link, aspect, fit, focalX, focalY, size, tiltX, tiltY, tiltZ, radialOffset, backgroundColor }`；所有字段都会安全默认和限幅。`fit: 'cover'` 保持原图比例并按 focal point 裁切，`fit: 'contain'` 在 `backgroundColor` 上完整显示；没有真实 `link` 的项目不会进入 3D 点击目标。
- `src/gallery.js`：`SPIRAL_LAYOUT` 集中配置桌面、竖屏手机和 compact landscape 的螺旋参数。桌面参数和 `?spiral-calibration=1` 路径保持第一阶段标定值；正常访问使用统一 `motionState.current` 驱动滚轮、拖动、键盘、阻尼磁吸和路径焦点。卡片材质使用最多 3×3 九次采样，主卡片或低画质模式只采样一次；真实图片加载前显示 1.6 placeholder，加载失败保持 placeholder。
- `src/transition.js`：`TRANSITION_TIMING` 配置转场节奏，总时长默认 1.55 秒。文字、球体、网格、舞台与顶部标识共用一个新时间轴。
- `src/styles.css`：末尾 gallery 样式控制网格、顶部边距、标识尺寸和静态降级槽位。
- `src/intro.js`：原开场参数与个人文案保持在 `INTRO_*` 中。旧开场停在 final，新转场只由 enter 触发。

笑脸复用同一 DOM 节点和 canvas，通过占位元素保持欢迎布局；以实际 DOM 矩形计算飞行起终点，并在 resize 后更新终点。画廊提前初始化，不等点击后加载。真实项目在精确指针环境才启用节流 hover Raycaster，只检测当前可见且有链接的 Mesh；8px 以内视为 click，超过阈值视为 drag，pointercancel 不导航。网格视差仅在桌面启用且不超过 3px/4px，reduced-motion 会关闭。画质只根据视口像素、DPR、设备类型和 reduced-motion 选择 high/medium/low，不做每帧 FPS 切换。静止时按需渲染，隐藏标签页暂停，重建和卸载使用引用计数确保纹理、材质只释放一次。

## 检查入口

- `/?replay=1`：重播完整开场。
- `/?intro-state=hello`、`name`、`final`：查看开场关键状态。
- `/?replay=1&debug=1`：开发环境显示 replay intro，用于检查进入后重播。
- `/?intro-state=final&no-webgl=1`：模拟无 WebGL，显示静态灰色卡片及 CSS 笑脸。
- `/?intro-state=final&reduced-motion=1`：开发环境模拟减少动态效果，进入使用短淡入。
- `/?spiral-calibration=1`：跳过 intro，固定 `current = target = 0`，以统一尺寸、统一宽高比、无模糊/透明度/hover/网格移动的静态螺旋进行构图验收，不受真实项目比例、动态画质或移动端阶段三参数影响。

## 本轮验证

生产构建通过（Vite 提示包含 Three.js 的主包超过 500 kB）。第三阶段浏览器检查覆盖 360×800、375×812、390×844、430×932、768×1024、844×390、932×430、spiral/list 往返、键盘、拖动、no-WebGL fallback、shader 编译和控制台错误；390×844 中央 placeholder 约占 73% 屏宽，横屏使用独立 compact-landscape 并保证卡片完整可见。真实项目异步加载、真实手机触摸、系统动态偏好切换和真实 GPU 上下文丢失仍需设备复核。转场方案按本次要求设计，不声称是参考站的精确动画。
