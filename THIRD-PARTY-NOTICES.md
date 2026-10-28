# 第三方来源与许可

本项目的非商业限制仅覆盖发布者有权授权的原创部分。第三方组件继续按原许可证使用，本项目不改变其商业使用权利，也不声称训练了千问模型。

| 组件 | 当前基线 | 上游许可与来源 |
| --- | --- | --- |
| Electron | 45.0.0 | MIT；Chromium、Node.js 等内含组件保留各自通知：[Electron](https://www.electronjs.org/) |
| 基础模型 Qwen3-ASR-0.6B | Qwen 官方模型 | Apache-2.0：[Qwen3-ASR](https://github.com/QwenLM/Qwen3-ASR) |
| 社区 MLX 量化模型 | revision `4c59c533f95c84afb796655e814709034f826f04` | Apache-2.0：[模型页](https://huggingface.co/moona3k/mlx-qwen3-asr-0.6b-4bit) |
| mlx-qwen3-asr | 0.4.4 | Apache-2.0：[推理库](https://github.com/moona3k/mlx-qwen3-asr) |
| Apple MLX | 0.32.4 | MIT：[MLX](https://github.com/ml-explore/mlx) |
| Python | 3.12.14 | PSF 与所含组件各自许可证：[Python](https://www.python.org/) |

发行包保留 Electron/Chromium 原始许可证、Python 及全部依赖的许可与 NOTICE（若存在）。依赖锁、模型 revision、文件哈希一起记录，模型与 Python 不混入普通 Git 源码提交。

Electron 发行包已与官方 GitHub Release 的 SHA-256 独立比对。固定下载来源和校验值见 runtime.lock.json。

官方中文测试样本由 Qwen 示例引用。本仓库及发行包不附带该音频；界面中的“检查本地模型”只确认模型加载状态，不进行音频转写。

旧版本曾使用的云端接口与 Vosk 不是当前本地版本依赖，不带入新的发布说明或依赖清单。
