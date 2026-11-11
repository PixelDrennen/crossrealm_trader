#!/usr/bin/env bash
set -euo pipefail
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3 is required. On Fedora: sudo dnf install python3' >&2
  exit 1
fi
python3 - "$@" <<'PY'
import hashlib
import json
import os
import pathlib
import platform
import shutil
import subprocess
import sys
import tempfile
import urllib.request

REPO = 'PixelDrennen/crossrealm_trader'
API = f'https://api.github.com/repos/{REPO}/releases/latest'


def download(url, destination=None):
    request = urllib.request.Request(url, headers={'User-Agent': 'Crossrealm-Trader-Installer', 'Accept': 'application/vnd.github+json' if url == API else 'application/octet-stream'})
    with urllib.request.urlopen(request, timeout=120) as response:
        if destination is None:
            return response.read()
        with open(destination, 'wb') as output:
            shutil.copyfileobj(response, output)


def desktop_quote(value):
    # Escape the desktop-entry string layer and the Exec argument layer.
    result = '"'
    for char in str(value):
        if char == '\\':
            result += '\\\\\\\\'
        elif char in '"`$':
            result += '\\\\' + char
        elif char == '%':
            result += '%%'
        elif char in '\n\r':
            raise ValueError('Installation path cannot contain line breaks')
        else:
            result += char
    return result + '"'


def atomic_write(destination, content, mode=0o644):
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='.crossrealm-', dir=destination.parent)
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(content)
        os.chmod(temporary, mode)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def install():
    if sys.platform != 'linux' or platform.machine() not in ('x86_64', 'amd64'):
        raise ValueError('This release supports x86_64 Linux.')
    if os.geteuid() == 0:
        raise ValueError('Run this installer as your normal user, without sudo.')
    home = pathlib.Path.home()
    app_dir = home / '.local/opt/crossrealm-trader'
    data_home = pathlib.Path(os.environ.get('XDG_DATA_HOME') or home / '.local/share')
    if not data_home.is_absolute():
        raise ValueError('XDG_DATA_HOME must be an absolute path.')
    image = app_dir / 'Crossrealm-Trader.AppImage'
    launcher = home / '.local/bin/crossrealm-trader'
    desktop = data_home / 'applications/crossrealm-trader.desktop'
    icon = data_home / 'icons/hicolor/512x512/apps/crossrealm-trader.png'
    # Validate paths before any writes.
    executable = desktop_quote(launcher)
    print('Finding the latest Crossrealm Trader release…', flush=True)
    release = json.loads(download(API))
    assets = {asset['name']: asset for asset in release['assets']}
    images = [name for name in assets if name.endswith('-x86_64.AppImage')]
    if len(images) != 1:
        raise ValueError('Release does not contain exactly one x86_64 AppImage.')

    def asset_url(name):
        url = assets[name]['browser_download_url']
        if not url.startswith(f'https://github.com/{REPO}/releases/download/'):
            raise ValueError('Unexpected release download URL.')
        return url

    checksums = {}
    for line in download(asset_url('SHA256SUMS')).decode().splitlines():
        checksum, filename = line.split(maxsplit=1)
        checksums[filename.lstrip('*')] = checksum
    with tempfile.TemporaryDirectory(prefix='crossrealm-install-') as temporary:
        verified = {}
        for filename in (images[0], 'crossrealm-trader.png'):
            print(f'Downloading {filename}…', flush=True)
            destination = pathlib.Path(temporary) / filename
            download(asset_url(filename), destination)
            with destination.open('rb') as downloaded:
                checksum = hashlib.file_digest(downloaded, 'sha256').hexdigest()
            if checksum != checksums.get(filename):
                raise ValueError(f'Checksum verification failed: {filename}')
            verified[filename] = destination
        # Install only after both downloaded assets pass verification.
        app_dir.mkdir(parents=True, exist_ok=True)
        fd, temporary_image = tempfile.mkstemp(prefix='.crossrealm-', dir=app_dir)
        os.close(fd)
        try:
            shutil.copyfile(verified[images[0]], temporary_image)
            os.chmod(temporary_image, 0o755)
            os.replace(temporary_image, image)
        finally:
            if os.path.exists(temporary_image):
                os.unlink(temporary_image)
        atomic_write(icon, verified['crossrealm-trader.png'].read_bytes())
    # A stable filename keeps this launcher valid after electron-updater replaces the AppImage.
    import shlex
    shell_image = shlex.quote(str(image))
    launcher_body = '#!/usr/bin/env bash\nset -e\n'
    launcher_body += 'if command -v ldconfig >/dev/null 2>&1 && ldconfig -p 2>/dev/null | grep -q "libfuse.so.2"; then\n'
    launcher_body += f'  exec {shell_image} "$@"\nelse\n'
    launcher_body += f'  export APPIMAGE_EXTRACT_AND_RUN=1\n  exec {shell_image} "$@"\nfi\n'
    atomic_write(launcher, launcher_body.encode(), 0o755)
    entry = '[Desktop Entry]\nType=Application\nVersion=1.0\nName=Crossrealm Trader\nComment=Compare WoW Retail prices across realms\n'
    entry += f'Exec={executable}\nIcon=crossrealm-trader\nTerminal=false\nCategories=Game;Utility;\nStartupWMClass=crossrealm-trader\n'
    atomic_write(desktop, entry.encode())
    for command in (['update-desktop-database', str(desktop.parent)], ['gtk-update-icon-cache', '-f', '-t', str(data_home / 'icons/hicolor')]):
        if shutil.which(command[0]):
            subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    print(f'Installed {release["tag_name"]}. Open Crossrealm Trader from your application menu.')
    print('Automatic updates remain enabled. Existing settings, lists and favorites are preserved.')


if __name__ == '__main__':
    try:
        install()
    except Exception as error:
        print(f'Installation failed: {error}', file=sys.stderr)
        sys.exit(1)
PY
