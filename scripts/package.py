"""Build a clean Apple Silicon app with local ad-hoc signing; not Apple notarization."""
from pathlib import Path
import hashlib, json, plistlib, shutil, subprocess, sys

root=Path(__file__).resolve().parents[1]
runtime=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'build/electron/Electron.app'
metadata=json.loads((root/'package.json').read_text())
lock=json.loads((root/'runtime.lock.json').read_text())
name=metadata['productName']
target=root/'dist'/f'{name}.app'
if target.exists(): raise SystemExit('Output already exists; move the previous dist app aside first.')
engine=root/'local-engine'
if not (engine/'python/.hubao-prepared.json').is_file(): raise SystemExit('Run scripts/prepare_runtime.py first.')
for item in lock['model']['files']:
    with (engine/'model'/item['name']).open('rb') as f:
        if hashlib.file_digest(f,'sha256').hexdigest()!=item['sha256']: raise SystemExit('Model verification failed.')
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(runtime)],check=True)
target.parent.mkdir(exist_ok=True)
subprocess.run(['/usr/bin/ditto',str(runtime),str(target)],check=True)
resources=target/'Contents/Resources'
default=resources/'default_app.asar'
if default.exists(): default.unlink()
payload=resources/'app';payload.mkdir()
shutil.copy2(root/'package.json',payload/'package.json')
shutil.copytree(root/'src',payload/'src')
shutil.copytree(root/'licenses',resources/'licenses')
for filename in ['LICENSE','ASSETS-LICENSE.md','PRIVACY.md','THIRD-PARTY-NOTICES.md','runtime.lock.json']:
    shutil.copy2(root/filename,resources/filename)
destination=resources/'local-engine';destination.mkdir()
for filename in ['bridge.py','requirements-lock.txt']:
    shutil.copy2(engine/filename,destination/filename)
shutil.copytree(engine/'python',destination/'python',symlinks=True,
                ignore=shutil.ignore_patterns('__pycache__','*.pyc','*.download'))
(destination/'model').mkdir()
for item in lock['model']['files']:
    shutil.copy2(engine/'model'/item['name'],destination/'model'/item['name'])
info=target/'Contents/Info.plist';data=plistlib.loads(info.read_bytes())
(target/'Contents/MacOS'/data['CFBundleExecutable']).rename(target/'Contents/MacOS'/name)
data.update(CFBundleExecutable=name,CFBundleName=name,CFBundleDisplayName=name,
    CFBundleIdentifier='io.github.sunxinti.hubaoxuebaodictation',
    CFBundleShortVersionString=metadata['version'],CFBundleVersion='6',
    NSMicrophoneUsageDescription='虎宝和雪宝使用麦克风在本机识别唤醒词和听写。录音不会上传。',
    LSMinimumSystemVersion='26.0',LSUIElement=True,NSHighResolutionCapable=True,
    LSApplicationCategoryType='public.app-category.productivity')
for key in ('ElectronAsarIntegrity','NSCameraUsageDescription','NSBluetoothAlwaysUsageDescription',
            'NSBluetoothPeripheralUsageDescription','NSAudioCaptureUsageDescription','NSAppTransportSecurity'):
    data.pop(key,None)
shutil.copy2(root/'src/app.icns',resources/'app.icns');data['CFBundleIconFile']='app.icns'
info.write_bytes(plistlib.dumps(data))
subprocess.run(['/usr/bin/codesign','--force','--deep','--sign','-',
                '--entitlements',str(root/'scripts/entitlements.plist'),str(target)],check=True)
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(target)],check=True)
print(target)
