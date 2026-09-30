# 曹波个人网站

沿用 Vite、GSAP 和 Three.js。首屏使用审核通过的暖色三幕视频（8.5 秒）：欢迎 → 我是曹波 → 这是我的个人网站。最后一幕的“点击进入”由真实 HTML 按钮实现，并淡入螺旋画廊。真实作品可以通过 `src/projects.js` 接入，当前空数组继续使用确定性的 placeholder。

## 运行

```sh
npm run dev
npm run build
```

## 调整位置

- `src/projects.js`：真实作品数组 `projects`。每项支持 `{ id, title, cover, link, aspect, fit, focalX, focalY, size, tiltX, tiltY, tiltZ, radialOffset, backgroundColor }`；所有字段都会安全默认和限幅。`fit: 'cover'` 保持原图比例并按 focal point 裁切，`fit: 'contain'` 在 `backgroundColor` 上完整显示；没有真实 `link` 的项目不会进入 3D 点击目标。
- `src/gallery.js`：`SPIRAL_LAYOUT` 集中配置桌面、竖屏手机和 compact landscape 的螺旋参数。桌面参数和 `?spiral-calibration=1` 路径保持第一阶段标定值；正常访问使用统一 `motionState.current` 驱动滚轮、拖动、键盘、阻尼磁吸和路径焦点。卡片材质使用最多 3×3 九次采样，主卡片或低画质模式只采样一次；真实图片加载前显示 1.6 placeholder，加载失败保持 placeholder。
- `src/transition.js`：`TRANSITION_TIMING` 配置视频退出和画廊淡入，总时长默认 0.8 秒。
- `src/styles.css`：末尾 gallery 样式控制网格、顶部边距、标识尺寸和静态降级槽位。
- `src/intro.js`：管理静音内联自动播放、最后一幕停留、按钮与视频同步、跳过、减少动态效果、播放失败降级和会话记忆。
- `public/media/`：生产视频与首尾静态帧。视频画面与审核版一致；使用不含绘制按钮的同源画面，网页按钮按审核版的 7.02 秒入场节奏淡入，避免手机放大后出现重叠按钮。

画廊提前初始化，不等点击后加载。真实项目在精确指针环境才启用节流 hover Raycaster，只检测当前可见且有链接的 Mesh；8px 以内视为 click，超过阈值视为 drag，pointercancel 不导航。网格视差仅在桌面启用且不超过 3px/4px，reduced-motion 会关闭。画质只根据视口像素、DPR、设备类型和 reduced-motion 选择 high/medium/low，不做每帧 FPS 切换。静止时按需渲染，隐藏标签页暂停，重建和卸载使用引用计数确保纹理、材质只释放一次。

## 检查入口

- `/?replay=1`：重播完整开场。
- `/?intro-state=final`：直接查看最后一幕（静态帧），按钮正常可用。
- 开发环境提供 `window.__intro.replay()` 与 `window.__intro.skip()`。
- `/?intro-state=final&no-webgl=1`：检查最后一幕与无 WebGL 的画廊降级。
- `/?intro-state=final&reduced-motion=1`：开发环境模拟减少动态效果，进入使用短淡入。
- `/?spiral-calibration=1`：跳过 intro，固定 `current = target = 0`，以统一尺寸、统一宽高比、无模糊/透明度/hover/网格移动的静态螺旋进行构图验收，不受真实项目比例、动态画质或移动端阶段三参数影响。

## 本轮验证

生产构建通过（Vite 提示包含 Three.js 的主包超过 500 kB）。第三阶段浏览器检查覆盖 360×800、375×812、390×844、430×932、768×1024、844×390、932×430、spiral/list 往返、键盘、拖动、no-WebGL fallback、shader 编译和控制台错误；390×844 中央 placeholder 约占 73% 屏宽，横屏使用独立 compact-landscape 并保证卡片完整可见。真实项目异步加载、真实手机触摸、系统动态偏好切换和真实 GPU 上下文丢失仍需设备复核。转场方案按本次要求设计，不声称是参考站的精确动画。

## 视频接入验证

首屏视频保持完整 16:9 画面，不裁切、不循环；无声自动播放，完成后保持末帧。“点击进入”支持鼠标、触摸与键盘，手机按钮至少 120×44 CSS 像素。Escape 或“跳过动画”显示最后一幕；播放被阻止、媒体出错或持续缓冲时也显示最后一幕。标签页隐藏时暂停；减少动态效果直接显示静态末帧。每次打开或刷新页面都会从头播放开场，不根据当前会话的观看或进入记录跳过。

生产构建通过。浏览器验证覆盖桌面自动播放至 8.5 秒、末帧按钮进入、390×844 手机显示及按钮点击、跳过与键盘 Enter、减少动态效果、再次访问与重播。视频约 1.32 MB，无新增运行时依赖。
