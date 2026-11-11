# Crossrealm Trader

A Linux desktop browser for **WoW Retail realm pricing**, powered by [TSM's public CSV data](https://tradeskillmaster.com/public-data). No TSM account, API key, characters, or Blizzard credentials required.

## Install on Fedora

Run the installer as your normal user (no sudo):

```bash
curl -fL https://github.com/PixelDrennen/crossrealm_trader/releases/latest/download/install.sh -o crossrealm-install.sh && bash crossrealm-install.sh
```

It downloads the latest x86_64 AppImage, verifies release SHA-256 checksums, installs it permanently under `~/.local/opt/crossrealm-trader`, and adds **Crossrealm Trader** to Fedora/KDE's application menu with its icon. The launcher is also available at `~/.local/bin/crossrealm-trader`. It automatically uses extract-and-run mode if FUSE 2 is unavailable; it does not need sudo or disable Electron's sandbox.

The installed AppImage has a stable filename in a writable directory so automatic updates preserve the menu launcher. Updates download automatically, install on exit, and can be applied with the in-app restart button. Updates are checked on startup and every four hours. Close the app before rerunning the installer. Rerunning updates the installation without removing saved settings, favorites, lists or the ledger. You can remove the downloaded installer script afterward.

To uninstall, delete `~/.local/opt/crossrealm-trader`, `~/.local/bin/crossrealm-trader`, `~/.local/share/applications/crossrealm-trader.desktop`, and `~/.local/share/icons/hicolor/512x512/apps/crossrealm-trader.png` (use your `XDG_DATA_HOME` location for the last two when configured). Settings remain in `~/.config/crossrealm-trader` unless you separately remove them.

An RPM is also built for conventional `sudo dnf install ./Crossrealm-Trader-*.rpm` installation. In this version RPM users download newer RPMs from Releases; use AppImage for automatic updates.

## Use

- Gurubashi starts as the home realm. Settings changes region, tracked realm slugs and default realm. Home always appears first.
- Search item names, item IDs or comma-separated `i:123,i:456` strings. Click a realm tab to retain the same search/list on that realm.
- Sort by name, minimum buyout, region sale average, region sale rate or sold per day.
- Star items to keep a favorites collection. Create named lists, add items with +, edit/import plain TSM item strings and copy lists as TSM-compatible item lists.
- **Compressed `!TSM` exports and operation/group hierarchy imports are not supported**. Plain item lists work; variant tokens are retained in saved lists and exports, but public CSV prices are **base item** prices.
- Commodities are region-wide and explicitly labeled. Connected realms share prices. These are aggregate item snapshots, not individual auctions: upstream data has no per-listing item level, seller, quantity or gear variant breakdown. Those details are intentionally not invented.
- Ledger imports accept a local Accounting/Ledger CSV export. Original fields remain intact. No direct SavedVariables reading or synchronization yet. The ledger view displays the first 2,000 rows; full imported rows are saved locally.

Prices are copper internally. Zero/missing prices display a dash; missing sale metrics remain unavailable, while actual zero metrics display zero. Sold/day is TSM's region metric, not a count of sales observed by this app. Realm and region upstream timestamps are displayed separately. Refresh downloads snapshots; automatic caching lasts one hour and offline fallback is visibly labeled.

Settings, lists, favorites, cached prices and imported ledger are stored in Electron's per-user application data directory (normally `~/.config/crossrealm-trader`). No local ledger data is uploaded.

## Develop and release

```bash
npm ci
npm test
npm start
npm run dist
```

Node 24 recommended. `npm run dist` builds x64 AppImage and RPM; RPM packaging needs `rpm`. The renderer is isolated, sandboxed and has no network access. Only the main process fetches allowlisted TSM URLs. App updates use electron-updater and this repository's GitHub Releases, not arbitrary URLs supplied in settings.

To ship an update: increment `package.json` and lockfile version together, commit, then push to `main` (or push a matching `vX.Y.Z` tag). New versions on main are released automatically; existing published versions are left alone. GitHub Actions tests, builds, uploads update metadata and packages and publishes the release. GitHub's built-in token needs no custom secret. Repository Actions must be enabled. Never overwrite an existing version; every update needs a higher version.

Initial build validation does not constitute an end-to-end Fedora installation or update test. Verify two published versions on Fedora before relying on unattended updates.
