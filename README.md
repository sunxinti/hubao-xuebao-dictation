<p align="center">
  <img src="assets/hubao-xuebao.png" alt="HuBao and XueBao, your two dictation companions" width="330">
</p>

<h1 align="center">HuBao &amp; XueBao Dictation</h1>
<p align="center"><strong>Two little dogs, here to write down your words.</strong></p>
<p align="center">Offline Qwen speech recognition for Mac · No API key or account needed</p>
<p align="center">English · <a href="README.zh-CN.md">简体中文</a></p>

We built this tool after struggling to dictate while using a remote desktop. HuBao and XueBao sit in a corner of your Mac: click, speak, and paste the text wherever you need it. We hope they make your day a little easier, too.

## Features

- Click the dogs or press **Option + Space** to start and stop dictation.
- Finish automatically after a pause, with adjustable timing.
- Copy from a floating text card, or use automatic copying.
- Keep the dogs alongside full-screen apps without activating the main window during dictation.
- Run Qwen3-ASR-0.6B locally, with adjustable dog sizes and optional voice wake-up.

**0.4.0 preview:** Apple Silicon, macOS 26+, currently configured for Chinese dictation. Voice wake-up phrases: “虎宝雪宝”, “虎宝虎宝”, “雪宝雪宝”, “你好虎宝”, and “你好雪宝”.

## Get started

This repository provides source code. To build on an Apple Silicon Mac, install Python 3.12+, Node 22+, and Apple command line tools, then run:

```sh
git clone https://github.com/sunxinti/hubao-xuebao-dictation.git
cd hubao-xuebao-dictation
node --test tests/*.test.cjs
python3 scripts/prepare_runtime.py
python3 scripts/package.py
```

The first build downloads the pinned runtime and model and checks their hashes. Allow about 4 GB of free disk space. See [build details](docs/BUILD.md).

Open `dist/虎宝雪宝听写.app`, wait for the model to load, and allow microphone access when prompted. Click a dog or press **Option + Space**, speak, then pause or click again. The result is copied automatically by default. Right-click the dogs for settings or to quit.

The build uses local ad-hoc signing and is not notarized by Apple.

## With a remote desktop

Run the tool on your **local Mac**, dictate, then paste into the remote computer. Remote pasting depends on your remote desktop software’s clipboard sharing. If it fails, try pasting into a local text field first.

## Privacy

Speech recognition runs locally with no cloud fallback. The app does not save recordings or a dictation history. Copied text enters your system clipboard; optional voice wake-up keeps the microphone active. See [privacy details](PRIVACY.md).

## Meet HuBao & XueBao

<p align="center"><img src="assets/hubao-xuebao-photo.jpg" alt="A photo of HuBao and XueBao" width="420"></p>

Our two little companions inspired this project. Their desktop portrait was made from this photo with AI-assisted background editing.

## License

| Content | License |
| --- | --- |
| Original code, scripts, and tests | [PolyForm Noncommercial 1.0.0](LICENSE) |
| Dog images and original documentation | [CC BY-NC 4.0](ASSETS-LICENSE.md) |
| Third-party components | [Their respective licenses](THIRD-PARTY-NOTICES.md) |

## One last thing

Thank you, HuBao and XueBao, for the company and the inspiration behind this little tool. And thank you for letting them join your desktop.

May HuBao and XueBao keep you company and help you put your words down with ease.
