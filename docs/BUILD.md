# 在自己的 Mac 上构建

环境：Apple Silicon、macOS 26+、Python 3.12+、Node 22+、Apple 命令行工具（提供 codesign）。预留约 4 GB 空间，用于下载、解压、应用和压缩包。

## 获取源码与检查

```sh
git clone https://github.com/sunxinti/hubao-xuebao-dictation.git
cd hubao-xuebao-dictation
node --test tests/*.test.cjs
```

## 准备独立运行环境

```sh
python3 scripts/prepare_runtime.py
```

准备脚本会：

1. 下载 `runtime.lock.json` 中固定的 Astral Python 独立发行包与 Electron，并校验 SHA-256。
2. 在 `local-engine/python/` 中安装 `requirements-lock.txt` 固定的二进制 wheel，使用 `--require-hashes` 校验，运行 pip check。
3. 下载固定 revision 的模型文件，逐个校验 SHA-256。
4. 解压 Electron，并逐文件、逐符号链接与官方哈希确认的压缩包比较；完成应用打包后再签名并校验。

首次准备需要联网。运行时只使用应用内的 Python、模型和管道，不读取个人 Python site-packages、云服务账号或凭据。

可选地提供已经下载的模型目录：

```sh
python3 scripts/prepare_runtime.py --model-cache /path/to/verified-model
```

缓存文件仍会逐个校验，不能跳过检查。下载不完整时可重试；如果运行目录被手动修改或锁文件已更新，请将旧目录移开并在干净目录重建。

## 打包与运行

```sh
python3 scripts/package.py
```

生成 `dist/虎宝雪宝听写.app`。脚本不覆盖已有应用包，并使用本机临时签名。临时签名不等于 Apple Developer 正式签名或公证。

在 Finder 中打开应用，等待模型就绪。首次听写需要在系统提示中允许麦克风权限。

“检查本地模型”只确认加载状态；实际识别请点击小狗试说，并核对转写。语音唤醒默认关闭，启用后会持续使用麦克风。

## 创建分发 ZIP

```sh
ditto -c -k --sequesterRsrc --keepParent 'dist/虎宝雪宝听写.app' 'dist/hubao-xuebao-dictation-0.4.0-macos-arm64.zip'
shasum -a 256 dist/hubao-xuebao-dictation-0.4.0-macos-arm64.zip
```

重新分发须保留应用内的代码许可证、素材许可和第三方通知。模型与运行组件不进入普通 Git 源码提交，完整下载包放到 Release 附件。

## 验证范围

源码测试覆盖 PCM/WAV 数据、停顿逻辑、唤醒词文本匹配、卡片复制、布局和不主动抢焦点的窗口调用。mock 窗口测试不代表所有远程桌面兼容性；语音准确率、不同输入设备、能耗和不同显示器组合请实际检查。
