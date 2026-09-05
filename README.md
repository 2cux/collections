# 曹波个人网站

沿用 Vite、GSAP 和 Three.js。原 hello!、弹球、二维矩形和 I'm caobo 时间轴保留；欢迎到螺旋页由独立时间轴控制。没有音频、真实作品或菜单按钮。

## 运行

```sh
npm run dev
npm run build
```

## 调整位置

- `src/projects.js`：真实作品数组 `projects`，当前为空。后续按 `{ cover, title, link }` 填入数据；封面路径会由画廊加载，标题与链接作为数据预留，本轮没有作品详情或链接交互。
- `src/gallery.js`：`SPIRAL_LAYOUT` 集中配置桌面/手机半径、每圈螺距、角间距、卡片宽度与比例、槽位数量、相机距离、输入速度、阻尼和像素比上限。
- `src/transition.js`：`TRANSITION_TIMING` 配置转场节奏，总时长默认 1.55 秒。文字、球体、网格、舞台与顶部标识共用一个新时间轴。
- `src/styles.css`：末尾 gallery 样式控制网格、顶部边距、标识尺寸和静态降级槽位。
- `src/intro.js`：原开场参数与个人文案保持在 `INTRO_*` 中。旧开场停在 final，新转场只由 enter 触发。

笑脸复用同一 DOM 节点和 canvas，通过占位元素保持欢迎布局；以实际 DOM 矩形计算飞行起终点，并在 resize 后更新终点。画廊提前初始化，不等点击后加载。滚轮、方向键和手机纵向拖动采用有限进度，停止输入后阻尼收敛；本轮没有循环回收。空白槽位没有可点击链接。静止时按需渲染，隐藏标签页暂停，卸载清理监听器与 GPU 资源。

## 检查入口

- `/?replay=1`：重播完整开场。
- `/?intro-state=hello`、`name`、`final`：查看开场关键状态。
- `/?replay=1&debug=1`：开发环境显示 replay intro，用于检查进入后重播。
- `/?intro-state=final&no-webgl=1`：模拟无 WebGL，显示静态灰色卡片及 CSS 笑脸。
- `/?intro-state=final&reduced-motion=1`：开发环境模拟减少动态效果，进入使用短淡入。

## 本轮验证

生产构建通过（Vite 提示包含 Three.js 的主包超过 500 kB）。浏览器检查欢迎进入、重复点击保护、桌面滚轮、390×844 布局、单个笑脸节点及其精确落点、无 WebGL / reduced-motion 模拟分支。真实手机触摸、系统动态偏好切换和真实 GPU 上下文丢失需要设备验证。转场方案按本次要求设计，不声称是参考站的精确动画。
