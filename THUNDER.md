# Thunder Sync (Remotely Save fork), Thunder Build

Personal build of [remotely-save/remotely-save](https://github.com/remotely-save/remotely-save) for Thunder's own devices. Upstream base: master at commit `34db181` (2024-11-10), version 0.5.25. Thunder branch: `thunder`.

Status (2026-11-02): renamed to Thunder Sync, settings page overhauled, pushed, and released.
- Fork: https://github.com/thunder-mythos/remotely-save, branch `thunder` pushed and verified (head `f63e5e1` at release time).
- BRAT release: **0.5.25-thunder.1**, non-draft, verified live at https://github.com/thunder-mythos/remotely-save/releases/tag/0.5.25-thunder.1 with assets `main.js`, `manifest.json`, `styles.css`, `thunder-sync.zip`. The release manifest carries id `thunder-sync`, name Thunder Sync, version `0.5.25-thunder.1` (downloaded back and checked).
- The build/test verification behind it is still local/staging proof from the VM, not a live-device install proof.
- One blocker: the release workflow is NOT live on GitHub. The gh OAuth token has no `workflow` scope, so GitHub rejected the first push for `.github/workflows/thunder-release.yml` only. The workflow is kept in the repo as `thunder-release.yml.txt`; move it back to `.github/workflows/thunder-release.yml` after a `gh auth refresh -s workflow` (needs Thunder's device approval), or create it in the GitHub web editor. Until then, releases are cut manually with `gh release create`, like this one. The bigger plugin rework is a later, separate task.

## Rename (confirmed by Thunder, 2026-11-02)

Name: **Thunder Sync**. Slug / plugin id: **thunder-sync**. This build installs as a separate plugin from upstream and can never be overwritten by the community version. The rename is in `manifest.json`, `manifest-beta.json`, and `package.json` name, plus the settings page H1.

- Internal strings do NOT change: the OAuth callback URIs (`remotely-save-cb`, `remotely-save-cb-pro`, and friends in `src/baseTypes.ts` and `pro/src/baseTypesPro.ts`), the OneDrive App Folder path segment `remotely-save`, and the remote metadata filenames in `src/metadataOnRemote.ts`. Changing those would orphan the existing remote vault at `Apps/remotely-save/BaseVault` and break OAuth redirects. The rename is an Obsidian-side identity change only.
- Consequences:
  - New plugin folder: `.obsidian/plugins/thunder-sync/` on each device.
  - Settings start fresh per device. `data.json` does not carry over from the old `remotely-save` folder automatically. To keep existing OneDrive auth and settings, quit Obsidian fully, copy the old `.obsidian/plugins/remotely-save/data.json` into `.obsidian/plugins/thunder-sync/`, then reopen. Otherwise just re-auth each service.
  - Command ids change with the slug, for example `thunder-sync:start-sync`.
  - BRAT installs code only. Settings (`data.json`) live per device and are never pulled by BRAT.

## Settings page overhaul (2026-11-02, before any push)

Thunder's order: clear the settings page out, no bs. Presentation and order only: every control and feature still exists, no settings key renamed, no default changed.

Before, top to bottom: H1, service chooser (dropdown rendered after all service panels), the selected service panel, Basic (password, encryption method, auto run, run on startup, sync on save, skip large files, status bar, ignore paths, only allow paths), Advanced (concurrency, sync underscore items, config folder, bookmarks, delete to where, conflict action, clear duplicates, protect modify percentage, sync direction), Import/Export, the Remotely Save PRO account section, Debug.

After, top to bottom:
1. Service chooser, then the selected service panel only (unchanged behavior).
2. **Sync behavior**: auto run interval, run on startup, sync on save, sync direction, conflict action (Smart Conflict is a plain option, no PRO mention), delete behavior.
3. **Encryption**: password, encryption method.
4. **Filters and safety**: skip large files, ignore paths, only allow paths, protect modify percentage, sync files starting with underscore, config folder sync, bookmarks sync.
5. **Advanced** (collapsed by default, `<details>`): concurrency, clear duplicate files, status bar items, mobile status bar. One click to open.
6. **Back up settings (import / export)** (collapsed by default): the old Import/Export section, QR export and import unchanged.
7. **Debug** (collapsed by default): log level, sync plans, profiler, cache and record tools, unchanged.

How it was done, `src/settings.ts`: the controls are still created by the upstream code in upstream order, then the Thunder layout block at the end of `display()` moves the existing setting elements into the new section divs, drops the empty Basic shell, and wraps Advanced / Import-Export / Debug in `<details>` elements whose summary replaces the old H2. Minimal CSS for the details sections is at the end of `styles.css` (class `thunder-settings-details`).

PRO account section: still generated (other code holds references to the per-service "allowed to use" divs and hint settings it wires up), then hidden with the existing `.pro-hide` class. It is not visible, not reachable, and no account is needed. Service auth panels (Google Drive, Box, and the rest) are untouched and fully in place.

Words: all "(PRO)" / "(PRO feature)" labels are stripped from the English strings, Smart Conflict is just "Smart Conflict", its description is now two plain sentences, every service's long disclaimer wall is cut to at most 2 short sentences (what it connects to, and that credentials stay on the device), and the section headings the overhaul touches are short plain labels ("Remote service", "Advanced", "Back up settings (import / export)"). English locale only; keys unchanged, values only.

## What was changed vs upstream

Nothing was cut. Every service and feature is kept: S3 and S3-compatible, Dropbox, OneDrive (App Folder), OneDrive (Full), WebDAV, Webdis, Google Drive, Box, pCloud, Yandex Disk, Koofr, Azure Blob Storage, Smart Conflict, end-to-end encryption, scheduled auto sync, and sync on save.

1. PRO subscription gate neutralized, `pro/src/account.ts` (search `THUNDER:`):
   - `THUNDER_ALL_PRO_FEATURES` lists all 8 PRO features exactly once: `feature-smart_conflict`, `feature-onedrive_full`, `feature-google_drive`, `feature-box`, `feature-pcloud`, `feature-yandex_disk`, `feature-koofr`, `feature-azure_blob_storage`.
   - `DEFAULT_PRO_CONFIG.enabledProFeatures` is seeded with that list, so fresh installs show every PRO service panel.
   - `checkProRunnableAndFixInplace` (the sync-time gate, called once from `pro/src/sync.ts`) now always passes, resets a stale empty feature list in place, and never contacts the Remotely Save account server.
   - `src/main.ts` loadSettings also forces the full feature list on load, because the settings UI hides each PRO service panel unless its feature is listed. That covers existing installs whose `data.json` has the old empty list.
   - The PRO account UI is generated but hidden from the settings page (see Settings page overhaul above). No PRO service code was deleted.
2. Build fixes for age, `package.json` only (upstream ships no lockfile, so installs float and the 2024 ranges now resolve to breaking versions):
   - `typescript` pinned to `5.5.4` (was `^5.5.4`, which now floats to 5.9.x and fails the type check with 19 errors).
   - `node-diff3` pinned to `3.1.2` (3.2.x switched to exports-only packaging and breaks the repo's `moduleResolution: "node"`).
   - `terser-webpack-plugin` `^5.3.10` added as a devDependency (current webpack no longer bundles it, and `webpack.config.js` requires it).
   - npm `overrides` pins `clean-stack` to `5.2.0` (5.3.0 added a `node:url` import that webpack's web target cannot handle).
3. `.gitignore`: explicit `.env` entry (local OAuth credentials, never commit).
4. `.github/workflows/thunder-release.yml`: builds on push to `thunder` or manual dispatch, runs tests, verifies PRO strings in the built `main.js`, and on a manual dispatch with a tag publishes a non-draft release for BRAT (tag style `0.5.25-thunder.1`).
5. `thunder.env.example.txt`: blank template for a personal build's OAuth credentials.
6. `thunder-sync-state.json`: fork and sync state.

## Local build record (2026-11-02, VM, Node 24.22.1, local/staging only)

- `npm install` fails on this VM with EPERM on a bin-link chown (workspace filesystem). Workaround used: `npm install --no-bin-links`, then binaries are run directly with node (for example `node node_modules/webpack/bin/webpack.js --mode production`). On a normal filesystem and in GitHub Actions, plain `npm install` and `npm run build` work.
- Stock (before Thunder changes): type check failed with 19 errors, webpack build failed on the missing terser plugin, esbuild build failed on floated AWS SDK code vs the es2016 target.
- After fixes: `tsc -noEmit -skipLibCheck` passes clean. Webpack production build passes, `main.js` about 4.0 MB.
- Tests: 70 passing, 2 failing. The 2 failures are the Encryption OpenSSL encrypt/decrypt tests in `tests/encryptOpenSSL.test.ts`. They fail identically on the unmodified stock code in this environment, so they are pre-existing here, not caused by the Thunder changes. They are not hidden: the release workflow runs the test suite, and if they fail in CI the manual release fallback applies.
- The webpack build also emits two lazy chunks (`274.main.js` about 4 KB, `955.main.js` about 211 KB, AWS SDK dynamic imports). Upstream's own releases ship only `main.js`, `manifest.json`, and `styles.css`, so this build keeps the same release shape.
- Built `main.js` grep verification: `googledrive` 184, `onedrivefull` 198, `azureblobstorage` 166, `smart_conflict` 30, `pcloud` 213, `yandex` 220, `koofr` 214, `webdav` 204, `webdis` 89, `dropbox` 255, `box` 982 (substring, includes unrelated words). All 8 `feature-*` names present. The old gate error text ("haven't subscribe") appears 0 times, and the Thunder gate debug line is present.

## OAuth apps: whose keys a service needs

The author's OAuth client IDs and secrets are not in this repo. Both build configs (`esbuild.config.mjs`, `webpack.config.js`) inject them at build time from a local `.env` file (see `thunder.env.example.txt`). The delivered build uses empty placeholders. No secrets were invented or extracted.

Ready with user-supplied credentials alone, no app registration:

| Service | What you supply in plugin settings |
|---|---|
| S3 / S3-compatible | Endpoint, region, access key, secret key, bucket |
| OneDrive (App Folder) | Your Microsoft sign-in (built-in client id in code) |
| OneDrive (Full) | Your Microsoft sign-in, client id field in its settings |
| WebDAV | Server URL, username, password |
| Webdis | Your own server URL and protection |
| Azure Blob Storage | Your container SAS URL |
| Smart Conflict | Nothing, it is local merge logic |

Code-complete and gate-free, but auth needs Thunder's own OAuth app registration first (create an app with the provider, put its client id and secret in `.env`, rebuild):

| Service | Env vars |
|---|---|
| Google Drive | `GOOGLEDRIVE_CLIENT_ID`, `GOOGLEDRIVE_CLIENT_SECRET` |
| Box | `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET` |
| pCloud | `PCLOUD_CLIENT_ID`, `PCLOUD_CLIENT_SECRET` |
| Yandex Disk | `YANDEXDISK_CLIENT_ID`, `YANDEXDISK_CLIENT_SECRET` |
| Koofr | `KOOFR_CLIENT_ID`, `KOOFR_CLIENT_SECRET` |

Also in `.env` if wanted: `DROPBOX_APP_KEY` (Dropbox with your own app key), `ONEDRIVE_CLIENT_ID` and `ONEDRIVE_AUTHORITY` (your own Microsoft app). `REMOTELYSAVE_WEBSITE` and `REMOTELYSAVE_CLIENT_ID` are only for the PRO account server, which this build no longer uses; leave them blank.

## Install

Planned path once released: BRAT on each of the 3 devices.

1. Install BRAT from the community plugin browser if it is not already there.
2. In BRAT, Add Beta Plugin: `thunder-mythos/remotely-save`.
3. Enable Thunder Sync in Community Plugins.
4. Set up each device's settings (or copy `data.json` over with Obsidian fully quit, see Rename above).
5. Never update this plugin from the community plugin browser afterwards. That replaces the Thunder build with upstream. Update only through BRAT from the Thunder repo.

Manual install alternative: quit Obsidian fully, copy `main.js`, `manifest.json`, and `styles.css` from a release into `.obsidian/plugins/thunder-sync/`, reopen, enable.

Always back up the vault before a first sync with any new build. That is upstream's own warning and it stands.
