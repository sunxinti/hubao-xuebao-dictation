"""Prepare verified Apple Silicon runtime and model artifacts; never use user site-packages."""
from pathlib import Path
import argparse, hashlib, json, os, platform, shutil, subprocess, sys, tarfile
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
LOCK = json.loads((ROOT / 'runtime.lock.json').read_text())

def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

def checked(path, sha):
    return path.is_file() and digest(path) == sha

def download(url, destination, sha):
    if checked(destination, sha): return
    if destination.exists(): raise RuntimeError(f'Unexpected existing file: {destination.name}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + '.download')
    subprocess.run(['curl', '--fail', '--location', '--retry', '3', '--connect-timeout', '20',
                    '--max-time', '1800', url, '--output', str(temporary)], check=True)
    if digest(temporary) != sha: raise RuntimeError(f'SHA-256 mismatch: {destination.name}')
    temporary.replace(destination)

def prepare(model_cache=None):
    if sys.version_info < (3, 12): raise SystemExit('Use Python 3.12 or newer.')
    if platform.system() != 'Darwin' or platform.machine() != 'arm64':
        raise SystemExit('This build targets Apple Silicon macOS only.')
    if int(platform.mac_ver()[0].split('.')[0]) < 26:
        raise SystemExit('The pinned runtime requires macOS 26 or newer.')
    cache = ROOT / 'build/cache';cache.mkdir(parents=True, exist_ok=True)
    for kind, filename in [('python','python.tar.gz'), ('electron','electron.zip')]:
        download(LOCK[kind]['url'], cache/filename, LOCK[kind]['sha256'])
    engine = ROOT/'local-engine';runtime = engine/'python';marker = runtime/'.hubao-prepared.json'
    base_marker = runtime/'.hubao-base.json'
    identity = {'python_sha256':LOCK['python']['sha256'], 'requirements_sha256':digest(engine/'requirements-lock.txt')}
    if runtime.exists() and not marker.exists() and not base_marker.exists():
        raise RuntimeError('Incomplete runtime found. Move local-engine/python aside before retrying.')
    if not runtime.exists():
        with tarfile.open(cache/'python.tar.gz') as archive: archive.extractall(engine, filter='data')
        base_marker.write_text(json.dumps({'python_sha256':LOCK['python']['sha256']})+'\n')
    if not marker.exists():
        if json.loads(base_marker.read_text())['python_sha256'] != LOCK['python']['sha256']:
            raise RuntimeError('Incomplete runtime belongs to a different Python archive.')
        py = runtime/'bin/python3'
        wheel_args=['--no-index','--find-links',str(cache/'wheels')] if (cache/'wheels/.complete').is_file() else ['--index-url','https://pypi.org/simple']
        subprocess.run([str(py), '-I', '-B', '-m', 'pip', 'install', '--isolated',
                        '--cache-dir',str(cache/'pip'), '--disable-pip-version-check', '--no-compile', '--only-binary=:all:', *wheel_args,
                        '--require-hashes', '-r', str(engine/'requirements-lock.txt')], check=True,
                       env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1','PIP_CACHE_DIR':str(cache/'pip')})
        subprocess.run([str(py), '-I', '-B', '-m', 'pip', 'check'], check=True)
        # Generated console launchers contain absolute build paths and are unused by the app.
        for entry in (runtime/'bin').iterdir():
            if entry.name not in {'python3','python3.12'} and (entry.is_file() or entry.is_symlink()): entry.unlink()
        for compiled in runtime.rglob('*.pyc'): compiled.unlink()
        for directory in sorted(runtime.rglob('__pycache__'), reverse=True):
            if directory.is_dir(): shutil.rmtree(directory)
        marker.write_text(json.dumps(identity, indent=2)+'\n')
    elif json.loads(marker.read_text()) != identity:
        raise RuntimeError('Runtime lock changed. Build again in a clean checkout.')
    model = engine/'model';model.mkdir(exist_ok=True)
    for item in LOCK['model']['files']:
        destination = model/item['name']
        if not checked(destination,item['sha256']):
            if destination.exists(): raise RuntimeError(f'Unexpected model file: {item["name"]}')
            cached = Path(model_cache)/item['name'] if model_cache else None
            if cached and checked(cached,item['sha256']): shutil.copyfile(cached,destination)
            else:
                url=f"https://huggingface.co/{LOCK['model']['repo']}/resolve/{LOCK['model']['revision']}/{quote(item['name'])}"
                download(url,destination,item['sha256'])
    electron = ROOT/'build/electron/Electron.app'
    if not electron.exists():
        electron.parent.mkdir(exist_ok=True)
        subprocess.run(['/usr/bin/ditto','-x','-k',str(cache/'electron.zip'),str(electron.parent)],check=True)
    subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(electron)],check=True)
    print('Runtime prepared. Build with: python3 scripts/package.py')

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model-cache', type=Path, help='Optional directory; model files are verified by SHA-256 before reuse.')
    prepare(parser.parse_args().model_cache)
