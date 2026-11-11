import hashlib
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

CODE = pathlib.Path('install.sh').read_text().split("<<'PY'\n", 1)[1].rsplit('\nPY', 1)[0]


class InstallerTest(unittest.TestCase):
    def run_installer(self, home, tamper=False):
        module = {'__name__': 'installer_test_module'}
        exec(compile(CODE, 'install.sh', 'exec'), module)
        image = b'#!/bin/sh\necho appimage\n'
        icon = b'icon bytes'
        assets = {'Crossrealm-Trader-0.1.1-x86_64.AppImage': image, 'crossrealm-trader.png': icon}
        checksums = '\n'.join(f'{hashlib.sha256(data).hexdigest()}  {name}' for name, data in assets.items()).encode()
        if tamper:
            assets['Crossrealm-Trader-0.1.1-x86_64.AppImage'] = b'corrupted'
        assets['SHA256SUMS'] = checksums
        release = {'tag_name': 'v0.1.1', 'assets': [{'name': name, 'browser_download_url': f'https://github.com/PixelDrennen/crossrealm_trader/releases/download/v0.1.1/{name}'} for name in assets]}

        def fake_download(url, destination=None):
            content = json.dumps(release).encode() if url == module['API'] else assets[url.rsplit('/', 1)[-1]]
            if destination:
                pathlib.Path(destination).write_bytes(content)
            else:
                return content

        module['download'] = fake_download
        with patch('pathlib.Path.home', return_value=home), patch('os.geteuid', return_value=1000), patch.dict('os.environ', {'XDG_DATA_HOME': str(home / 'Custom Data')}), patch('shutil.which', return_value=None):
            module['install']()
        return module

    def test_install_and_reinstall_preserve_settings_and_stable_launcher(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = pathlib.Path(temporary) / 'Home with spaces $special'
            home.mkdir()
            settings = home / '.config/crossrealm-trader/settings.json'
            settings.parent.mkdir(parents=True)
            settings.write_text('{"favorites":["i:123"]}')
            self.run_installer(home)
            image = home / '.local/opt/crossrealm-trader/Crossrealm-Trader.AppImage'
            self.assertEqual(image.stat().st_mode & 0o777, 0o755)
            launcher = home / '.local/bin/crossrealm-trader'
            self.assertIn(str(image), launcher.read_text())
            self.assertIn('export APPIMAGE_EXTRACT_AND_RUN=1', launcher.read_text())
            desktop = home / 'Custom Data/applications/crossrealm-trader.desktop'
            self.assertIn('Name=Crossrealm Trader', desktop.read_text())
            self.assertIn('Icon=crossrealm-trader', desktop.read_text())
            self.assertTrue((home / 'Custom Data/icons/hicolor/512x512/apps/crossrealm-trader.png').exists())
            self.run_installer(home)
            self.assertEqual(settings.read_text(), '{"favorites":["i:123"]}')
            self.assertEqual(len(list(image.parent.glob('*.AppImage'))), 1)

    def test_checksum_failure_does_not_replace_existing_installation(self):
        with tempfile.TemporaryDirectory() as temporary:
            home = pathlib.Path(temporary)
            image = home / '.local/opt/crossrealm-trader/Crossrealm-Trader.AppImage'
            image.parent.mkdir(parents=True)
            image.write_bytes(b'existing app')
            with self.assertRaisesRegex(ValueError, 'Checksum verification failed'):
                self.run_installer(home, tamper=True)
            self.assertEqual(image.read_bytes(), b'existing app')
            self.assertFalse((home / '.local/bin/crossrealm-trader').exists())


if __name__ == '__main__':
    unittest.main()
