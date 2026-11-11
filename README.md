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
- **Uncollected, Usable and Upgrades** remain disabled because complete collection, usability and equipped-gear data are not yet available from the local roster. Level metadata describes the base item, not a specific auction's item-level variant. No metadata or category is fabricated from an item ID or name.
- Same-region deal searches deduplicate connected auction houses. Commodities are compared only to region sale averages, once per region. Results are listing/benchmark estimates, not guaranteed realizable profits; fees are configurable and deposits are not modeled.
- Sort deal results by buyout, target price, net estimate or ROI. Click a result to compare its realms, add an item to a list, or save all results as one list.
- Star items for favorites. Create and edit named lists; copy them as plain TSM-compatible item strings. **Compressed `!TSM` exports and operation/group hierarchy imports remain unsupported.** Variant tokens are retained in saved lists/exports; public pricing is at base-item level.
- Ledger connects to Retail TSM SavedVariables automatically, with character discovery, 30-second refresh, pagination, and CSV import as a fallback. See the local connection section below.

Prices are copper internally. Zero/missing prices display a dash; missing sale metrics remain unavailable, while actual zero metrics display zero. Sold/day is TSM's region metric, not a count of sales observed by this app. Realm and region upstream timestamps are displayed separately. Refresh downloads snapshots; automatic caching lasts one hour and offline fallback is visibly labeled.

Settings, lists, favorites, cached prices and imported ledger are stored in Electron's per-user application data directory (normally `~/.config/crossrealm-trader`). No local ledger data is uploaded.

## Develop and release

```bash
npm ci
npm test
npm start
npm run dist
```

Node 24 recommended. `npm run dist` builds x64 AppImage and RPM; RPM packaging needs `rpm`. The renderer is isolated, sandboxed and has no network access. The main process fetches fixed/validated TSM pricing, realm-directory and item-metadata URLs plus Wowhead tooltip data; the renderer may load item images only from the allowlisted Wowhead image CDN. TSM page data is decoded as inert JSON references, never executed. Realm and creator-group snapshots are bundled for offline availability. App updates use electron-updater and this repository's GitHub Releases, not arbitrary URLs supplied in settings.

To ship an update: increment `package.json` and lockfile version together, commit, then push to `main` (or push a matching `vX.Y.Z` tag). New versions on main are released automatically; existing published versions are left alone. GitHub Actions tests, builds, uploads update metadata and packages and publishes the release. GitHub's built-in token needs no custom secret. Repository Actions must be enabled. Never overwrite an existing version; every update needs a higher version.

Initial build validation does not constitute an end-to-end Fedora installation or update test. Verify two published versions on Fedora before relying on unattended updates.

## Local Retail connection and compact comparison UI (0.3)

The Ledger page now automatically reads Retail `WTF/Account/*/SavedVariables/TradeSkillMaster.lua` (sales, purchases, income, expenses, expired and canceled auctions). It detects WoW through the native Linux TSM client's `~/.config/tsm-app/config.toml`, its Flatpak config, Faugus `games.json`, and common Wine/Lutris/Bottles/Steam paths. **Choose WoW folder** is available for a custom location; selecting AddOns or WTF also resolves back to `_retail_`. No TSM credentials are read and no addon files are written. The native client's SQLite cache does not contain the ledger, so the source is SavedVariables, as used by its own Accounting view. The reader parses Lua data without executing Lua.

Files are checked every 30 seconds and on opening the ledger. WoW must first flush new data through `/reload` or logout. The page shows connection sources, timestamps, problems, detected characters, transaction filters and pagination. CSV import is retained as a fallback. This is a local-file connection, not access to the game process or online character roster. Characters found in Retail WTF folders, TSM scopes and supported ATT character records add their resolved realms automatically. Ambiguous regions are reported instead of guessed. Old or deleted characters can remain in saved folders until those folders are removed.

Connected realms are grouped into one tracked auction house. Hover realm names for the full membership. Default tabs show the first configured number plus character realms, up to ten, with Show more for all remaining houses. Drag tabs or use Alt+Left/Right to reorder. Character realms above that ten-tab limit remain available through Show more and realm dropdowns.

Split view uses a realm dropdown per side and a shared item-result identity list, search, filters, order and page. The left and right scroll containers remain independent. Missing prices on either side stay blank. Searches default to realm items. Both panels use the selected TSM price and reference sources: minimum buyout, realm market, realm historical, realm recent, region sale average, region market average or region historical. Comparison popups and Find Deals also support these valuations. Region sources are explicitly region-wide, not realm-specific; using market/historical values calculates benchmark spreads, not executable buy/sell prices.

Names use WoW rarity colors, rows are denser, and coin circles are larger. Item icons are fetched from the Wowhead icon CDN using the Wowhead tooltip endpoint and TSM group metadata. Crafting-quality badges use the tier images and exact tier-ID mapping from TSM's public item display (including Midnight's two-tier badges); no badge is shown without known tier data. Cached presentations are refreshed periodically. ATT-style hover panels combine sanitized public Wowhead item details, TSM group/source hierarchies, item IDs and available saved local collection/ledger records. They do not fabricate boss sources, drop rates or collection status; unknowns are labeled. This does not bundle ATT's full source database.

Find Deals selects all currently tracked auction houses by default. Creator groups are an optional collapsed section. Required/base-level controls are compact. Each side of the valuation can choose an available TSM price source; the region benchmark requires a region source. Same-region transfer rules and connected-house deduplication still apply.

References: [native Linux TSM app](https://github.com/exceptionptr/tsm-app-linux), [Wowhead tooltip integration](https://www.wowhead.com/tooltips), [TSM public groups](https://tradeskillmaster.com/retail/groups). Quality badge artwork is from Blizzard's game UI as displayed by TSM; all game artwork remains the property of its respective owners.

## Item labels and hover pricing (0.3.3)

Resolved public item names replace generic numbered labels throughout browsing, split panes, deal results and the ledger. Visible rows load cached/public tooltip metadata even when an icon is already known; resolutions stream into the table without waiting for the whole page. Equipment labels include the tooltip's actual item level, upgrade track and progress when those fields exist, for example `Pauldrons of the Forgotten Sacrifice · ilvl 334 · Mythic 6/6`. Non-equipment items show their name and useful known type, such as companion pet, mount or crafting reagent. Upgrade tracks are never inferred from item IDs or rarity. These level/track details describe the public tooltip item; the base-item TSM CSV quote cannot identify every listed auction's upgrade variant.

Item hover panels include available TSM minimum buyout, realm market/historical/recent values, region sale/market/historical averages, region sale rate and sold/day, plus realm/region scan timestamps. Hover pricing follows the row's realm, including the right split pane and deal-buy realm. Ledger items load pricing for their saved realm when necessary. Tooltip data failures do not hide already available TSM prices. Tooltips can be hovered and scrolled when their details exceed the window height.

## Directed buy-realm deal searches (0.4)

Find Deals separates **Where do you want to buy?** from **What should we compare against?** New configurations default to a specific buy realm (the current browser realm). Buy modes are a specific realm, only tracked auction houses where local Retail characters were detected, or all tracked realms. Comparison destinations can independently be other tracked realms, one chosen realm, or a regional TSM benchmark. The tracked comparison-realm list is collapsed by default; expanding it lets you narrow the destinations. A direction summary stays visible in both the configuration and results.

Character mode uses freshly read local character realms in the main process. If no characters can be resolved it reports the missing local connection instead of falling back to all realms. Connected aliases qualify as the same character/buy auction house. Purchases are restricted before opportunities are returned, and comparison-only realms never become buy realms. Searches retain the same-region and connected-house transfer exclusions. Legacy saved financial/item filters are preserved; the new buy-mode choice is saved with the search configuration.
