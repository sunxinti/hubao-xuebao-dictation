<p align="center">
  <img src="assets/hubao-xuebao.png" alt="虎宝和雪宝，两只陪你听写的小狗" width="330">
</p>

<h1 align="center">虎宝雪宝听写</h1>
<p align="center"><strong>两只小狗，帮你把话记下来。</strong></p>
<p align="center">Mac 本地千问语音识别 · 无需 API Key · 无需账号</p>
<p align="center"><a href="README.md">English</a> · 简体中文</p>

用 Mac 远程操作另一台电脑时，我们只是想把一句话变成文字，再顺手粘贴过去。试过一些软件，麦克风、焦点和窗口切换仍让这件小事变得麻烦。

于是，我们让虎宝和雪宝待在桌面一角：点一下，开口说话，再把文字粘贴到需要的地方。希望这个小工具也能帮到你。

## 它能做什么

- 点击小狗或按 **Option + 空格**，开始或结束听写。
- 说完停顿后自动转写，停顿时长可调。
- 在悬浮文字卡片中复制，也可自动复制。
- 陪伴全屏应用，日常听写不主动激活主窗口。
- 使用本地 Qwen3-ASR-0.6B，支持调整小狗大小和可选语音唤醒。

**0.4.0 预览版**：适用于 Apple Silicon Mac、macOS 26+，当前按中文听写配置。唤醒词：“虎宝雪宝”“虎宝虎宝”“雪宝雪宝”“你好虎宝”“你好雪宝”。

## 开始使用

当前仓库提供源码。请在 Apple Silicon Mac 上准备 Python 3.12+、Node 22+ 和 Apple 命令行工具，然后运行：

```sh
git clone https://github.com/sunxinti/hubao-xuebao-dictation.git
cd hubao-xuebao-dictation
node --test tests/*.test.cjs
python3 scripts/prepare_runtime.py
python3 scripts/package.py
```

首次构建会下载固定版本的运行组件和模型，并校验哈希；请预留约 4 GB 空间。详见[构建说明](docs/BUILD.md)。

打开 `dist/虎宝雪宝听写.app`，等待模型就绪，并在首次录音时允许麦克风访问。点击小狗或按 **Option + 空格** 开始说话，停顿或再次点击后转写，结果默认自动复制。右键小狗可打开设置或退出。

构建产物使用本机临时签名，尚未经过 Apple 公证。

## 配合远程桌面

在 **Mac 本机**运行工具，听写完成后，将文字粘贴到远程电脑。远程粘贴依赖 ToDesk 等软件的剪贴板同步；如果失败，请先在 Mac 本地文本框尝试。

## 隐私

语音在本机识别，没有云端识别后备线路。应用不保存录音或听写历史；复制会写入系统剪贴板，开启语音唤醒后会持续使用麦克风。详见[隐私说明](PRIVACY.md)。

## 认识虎宝和雪宝

<p align="center"><img src="assets/hubao-xuebao-photo.jpg" alt="虎宝和雪宝的合照" width="420"></p>

它们是这个工具的两位小伙伴，也是灵感的来源。桌面形象基于这张合照，经 AI 辅助处理背景制作。

## 许可

| 内容 | 许可 |
| --- | --- |
| 原创代码、脚本与测试 | [PolyForm Noncommercial 1.0.0](LICENSE) |
| 小狗图片与原创文档 | [CC BY-NC 4.0](ASSETS-LICENSE.md) |
| 第三方组件 | [各自许可证](THIRD-PARTY-NOTICES.md) |

## 最后

谢谢虎宝和雪宝，用日常的陪伴给了我们做这个小工具的灵感。也谢谢你，让它们来到你的桌面。

愿虎宝和雪宝陪你，把要说的话轻松记下来。
