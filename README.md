# LearnLayer

A local-first Chrome extension that adds a learning progress layer to existing courses and documentation. React, TypeScript, Vite, Manifest V3. No server, accounts, database, AI, or remote API calls.

## Build and load

Use Node.js 22.19+ and npm. From this folder:

```powershell
npm ci
npm test
npm run build
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this project's **dist** folder.
4. Open https://codejeet.com/system-design (it redirects to the first chapter).
5. Click the floating **LearnLayer** button or pin and open the toolbar extension.
6. Mark a chapter complete, click **Continue learning**, and reopen the panel. Refreshing should retain progress. Restart Chrome and check again.

After rebuilding, click **Reload** on the extension card and refresh existing website tabs. The popup can also inject the content script into an eligible tab that was open before installation.

On Windows, stop any running `npm run dev` process with **Ctrl+C** before running `npm ci`. Vite can hold Rollup's native binary open, causing `EPERM unlink` during reinstallation. If installation fails halfway through, stop the dev server and rerun `npm ci` before building; missing `tsc` usually means the dependency installation is incomplete.

## Implemented

- Chapter/module/lesson lists, labeled documentation sidebars, educational navigation, and anchored hierarchical headings.
- Conservative unsupported-page state. No invented chapters.
- Course and chapter IDs derived deterministically from canonical source paths, course titles, and chapter URLs. Responsive duplicate navigation is deduplicated.
- Manual complete/incomplete controls, completion percentage, completed filter, current chapter, next incomplete chapter, and all-complete state.
- `chrome.storage.local` persists independent chapter keys across popup closure, page changes, refreshes, and browser restarts. Storage changes update open panels across tabs.
- Shared dark React popup and floating panel. Injected UI uses Shadow DOM; page content and styles are preserved. Escape closes the floating panel.
- Wider chapter-first layout, larger chapter text and completion targets, keyboard-scrollable chapter list, completed filter, and a **Current** shortcut. Use the popup header's **↗** button to open the taller page panel. Very short windows scroll the entire panel instead of squeezing the list into a tiny area.
- **Reminders off/on** is an opt-in global preference. After at least 45 seconds with the tab visible and reaching the page bottom, the panel suggests completing the current chapter. It never marks completion automatically.
- Handles delayed navigation rendering and URL changes in single-page applications.

The current chapter remains the page you are actually viewing, even when completed. **Next up** points to the next incomplete chapter, wrapping to earlier unfinished chapters when necessary. Continue navigates; marking complete alone does not navigate.

## Architecture

```text
src/
  background/    Minimal MV3 service worker; no progress in worker memory
  content/       DOM lifecycle, isolated floating panel, message endpoint
  popup/         Active-tab lookup and messaging
  components/    Shared React panel and isolated styles
  detection/     Pure DOM heuristics and normalization
  storage/       Chrome local storage adapter; one key per chapter
  types/         Course, chapter, snapshot contracts
  utils/         Deterministic IDs, URL matching, next-chapter selection
  demo/          Browser-only UI preview with a localStorage adapter
```

Detection returns normalized data; storage and UI do not depend on individual website selectors. A future optional detector can implement the same contract without coupling the MVP to an API.

## Preview and validation

```powershell
npm run dev
```

Open http://127.0.0.1:5173/demo.html for an interactive sample. The preview uses **localStorage**, not Chrome storage, and is not a substitute for loading the extension. Its course is explicitly demo data; the extension detects the actual DOM.

Automated tests cover DOM detection, duplicate sidebars, stable identity between chapter pages, unsafe/off-origin links, unsupported pages, anchor matching, continuation, persistence through recreated course objects, concurrent writes, and storage failures. An integration test runs the production content script in jsdom with mocked Chrome APIs. This does not simulate a real Chrome restart.

CodeJeet's live rendered DOM was inspected: it exposes 16 cross-page chapter links in `nav[aria-label="Chapters"]`, alongside a separate table of contents. A captured chapter-link fixture tests this structure. The interactive preview was browser-tested for completion, continuation, reload persistence, and the unsupported state. The unpacked extension itself still needs the Chrome installation smoke test above because Chrome was unavailable through the connected browser tool.

## Permissions and local data

`storage` persists progress. `activeTab` and `scripting` let the popup inspect or initialize the selected page. The content script matches HTTP/HTTPS sites to offer the persistent floating button; Chrome will show site-access permission for those matches. Restrict access per site using Chrome's extension settings if preferred. There are no network calls from the extension, telemetry, or remote fonts. Clearing extension data or uninstalling removes local progress.

## Known limits

- Heuristics support obvious structures, not every website. Course menus with fewer than three links, canvas content, iframe-only courses, and arbitrary unlabeled card grids may be unsupported.
- Some labeled navigation may produce false positives. Same-origin links only; cross-domain lessons are excluded.
- IDs can change if a website renames a course or restructures chapter URLs. Common URL paths are pragmatic grouping, not a universal course identity solution.
- Heading tracking needs existing anchor IDs and an educational page title. At a page URL without a fragment, no heading is labeled current.
- Reminder timing measures visible-tab time, not mastery. It checks document scrolling, not nested scrolling containers or video completion. The suggestion appears inside the opened panel.
- Browser-internal pages, Chrome Web Store, PDF viewer, and other protected pages cannot be inspected. File URLs are not included.
- Progress is local to the Chrome profile, with no backup or cross-device sync.

## Next three features

1. Let users review and correct detected chapters or select a specific navigation list.
2. Add a saved-course library with resume links and JSON export/import for backup.
3. Add targeted site adapters and identity migration for navigation changes, backed by more real-site fixtures.
