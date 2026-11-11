# Crossrealm Trader

A Linux desktop browser for **WoW Retail realm pricing**, powered by [TSM's public CSV data](https://tradeskillmaster.com/public-data). No TSM account, API key, characters, or Blizzard credentials required.

## Install on Fedora

Download the **AppImage** from [Releases](https://github.com/PixelDrennen/crossrealm_trader/releases/latest). This is the recommended distribution for automatic updates.

```bash
mkdir -p ~/.local/opt/crossrealm-trader
mv ~/Downloads/Crossrealm-Trader-*.AppImage ~/.local/opt/crossrealm-trader/
chmod +x ~/.local/opt/crossrealm-trader/*.AppImage
~/.local/opt/crossrealm-trader/*.AppImage
```

If Fedora reports missing libfuse.so.2, install `sudo dnf install fuse-libs`. Keep the AppImage in a writable folder: updates download automatically, install on exit, and can be applied with the in-app restart button. Updates are checked on startup and every four hours. Never launch it with sudo or disable its sandbox.

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
