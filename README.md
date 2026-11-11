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

- Gurubashi starts as the home realm. Settings offers a searchable list of **558 Retail realms** grouped by US, EU, KR and TW. Track multiple regions simultaneously; changing the picker region retains previous selections. Existing realm settings are migrated automatically.
- Search names, item IDs or comma-separated `i:123,i:456` strings. Realm tabs preserve the selected search/list and display their region.
- Click an item name to open a **comparison popup**. Choose any two realms from the full directory, including different regions. See minimum buyout, region sale average, sale rate, sold/day, timestamps and an estimated spread after the 5% auction cut. Connected-realm and commodity comparisons are labeled. Cross-region comparisons are informational; transfer profits are never calculated across regions.
- **Find Deals** opens a saved configuration popup. Select tracked realms, a benchmark (best other tracked realm, home realm, or region sale average), buyout/profit/ROI/discount limits, regional price caps, sale-rate/sold-per-day thresholds, snapshot age and auction fee. The scanner runs asynchronously, reports progress, supports cancellation, and retains successful realm results if other downloads fail.
- Item filters include rarity, base item level, required level, category, subtype, binding, expansion, group path, favorites and saved lists. All selected filters narrow the chosen groups; multiple groups combine their memberships. Empty upper limits mean no maximum. Default regional price caps screen implausibly inflated listing comparisons; they exclude items without known region sale averages.
- The **18 attributed TSM public group presets** include mounts, Patterns & Plans, materials, consumables, housing decor, legacy transmog A–C and all twelve expansion archives from Vanilla through Midnight. Presets contain actual item IDs and group paths fetched from TSM, plus creator/source links and snapshot dates. `node scripts/build-catalog.cjs` rebuilds the bundled snapshots for a future release. Presets are not a complete index of all groups on TSM's website.
- Expansion and group-path filters use this community group coverage; unknown memberships are excluded. Rarity is read from group data where known. Other required metadata is fetched on demand from public TSM item pages and cached for 30 days, after financial filters narrow candidates. Metadata failures are reported and items that cannot satisfy active filters are excluded. Large metadata searches can take time; cancel from the results page.
- **Uncollected, Usable and Upgrades** are disabled because this version has no character data. Level metadata describes the base item, not a specific auction's item-level variant. No metadata or category is fabricated from an item ID or name.
- Same-region deal searches deduplicate connected auction houses. Commodities are compared only to region sale averages, once per region. Results are listing/benchmark estimates, not guaranteed realizable profits; fees are configurable and deposits are not modeled.
- Sort deal results by buyout, target price, net estimate or ROI. Click a result to compare its realms, add an item to a list, or save all results as one list.
- Star items for favorites. Create and edit named lists; copy them as plain TSM-compatible item strings. **Compressed `!TSM` exports and operation/group hierarchy imports remain unsupported.** Variant tokens are retained in saved lists/exports; public pricing is at base-item level.
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

Node 24 recommended. `npm run dist` builds x64 AppImage and RPM; RPM packaging needs `rpm`. The renderer is isolated, sandboxed and has no network access. Only the main process fetches fixed/validated TSM pricing, realm-directory and item-metadata URLs. TSM page data is decoded as inert JSON references, never executed. Realm and creator-group snapshots are bundled for offline availability. App updates use electron-updater and this repository's GitHub Releases, not arbitrary URLs supplied in settings.

To ship an update: increment `package.json` and lockfile version together, commit, then push to `main` (or push a matching `vX.Y.Z` tag). New versions on main are released automatically; existing published versions are left alone. GitHub Actions tests, builds, uploads update metadata and packages and publishes the release. GitHub's built-in token needs no custom secret. Repository Actions must be enabled. Never overwrite an existing version; every update needs a higher version.

Initial build validation does not constitute an end-to-end Fedora installation or update test. Verify two published versions on Fedora before relying on unattended updates.
