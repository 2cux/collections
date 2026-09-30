# 曹波个人网站

项目已清理为重构起点，保留开场视频和“点击进入”按钮。点击后显示温暖明亮的背景：奶油色底，柔和的桃色、浅金色与浅绿色渐变光晕。背景正中央显示半透明圆角问候卡片，配有用户提供的金发猫耳卡通头像、英文手写字体与青绿色 Cao Bo 名字。问候语按访客本地时间自动切换：05:00–11:59 为 Good Morning，12:00–17:59 为 Good Afternoon，其余时段为 Good Evening；页面保持打开时也会更新。

点击进入时，开场画面轻微放大并渐隐，约 1.2 秒内融入背景；系统启用减少动态效果时使用短暂淡出。

点击问候卡片进入角色界面，背景保持不变。角色素材基于用户提供的原图，经 ImageGen 补齐耳朵、清理外轮廓杂点，再采用 SVG 轮廓裁切分离头部和衣服，绑定独立眼睛；鼠标在页面任意位置移动时，双眼和头部会平滑跟随，并有自动眨眼、轻微呼吸。眼睛的球面投影与转向缩放参考 [Bencho Eye tracker](https://bencho.dev/blocks/magnet-select?c=eye-tracker&theme=dark)。点击返回或按 Escape 回到问候卡片，焦点回到卡片按钮；触摸屏支持点按位置跟随。后台页面和退出界面时停止 JavaScript 动画，系统减少动态效果时关闭转头、呼吸及自动眨眼。

当前实现是网页二维分层动画，不包含 Cubism 的 `.moc3` / `.model3.json` 原生 Live2D 模型。

## 运行

```sh
npm install
npm run dev
npm run build
```

## 文件

- `index.html`：开场视频和按钮。
- `src/main.js`：应用入口。
- `src/intro.js`：视频播放、末帧停留、按钮入场及点击处理。
- `src/character.js`：角色分层图形、眼睛投影、动画与界面切换。
- `src/character-art.js`：修复后的角色轮廓与眼睛位置校准。
- `src/styles.css`：开场样式和页面背景。
- `public/media/`：原有视频与首尾静态帧。

每次打开或刷新都会重新播放视频。播放失败、持续缓冲或系统启用减少动态效果时显示末帧。视频保持完整 16:9 画面，按钮支持鼠标、触摸和键盘。

开发时可通过 `/?intro-state=final` 查看末帧，通过 `window.__intro.replay()` 重播。


