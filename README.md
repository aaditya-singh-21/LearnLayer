# LearnLayer V3

A local-first Chrome extension that adds progress tracking to courses, documentation, and tutorials on existing websites. React, TypeScript, Vite, Manifest V3. No server, accounts, AI, remote API calls, or telemetry.

## Build and load

Use Node.js 22.19+ and npm:

```powershell
npm ci
npm test
```

`npm test` type-checks, builds `dist/`, and runs the Vitest regression suite. To build without tests, use `npm run build`.

1. Open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**.
2. Select this project's **dist** folder.
3. Open a course or documentation page (CodeJeet and MDN are examples, not hardcoded integrations).
4. Open the floating LearnLayer panel or toolbar popup.
5. Mark a chapter complete, open **My learning**, and find the course under **Recent courses**.
6. Choose **Save course** to keep it in **Saved courses**. Use **Resume** to reopen the last visited chapter.

After rebuilding, reload the extension card and refresh existing website tabs. The popup can initialize the content script in eligible tabs that were already open.

On Windows, stop `npm run dev` before running `npm ci`; Vite can hold native binaries open and cause `EPERM unlink`. Rerun `npm ci` after stopping the server if an installation was interrupted.

## Course library and editing

### Saved and recent courses

**My learning** opens a full extension-tab dashboard from the popup or floating panel, including on unsupported websites. Search by course title or hostname. Cards show completion and the last visited chapter.

- First successful chapter completion adds a course to Recent. Detection and editing alone do not enroll it.
- Recent contains the five most recently active unsaved courses. Saved courses do not consume these slots.
- Explicit Save moves a course to Saved; Unsave returns it to Recent.
- Leaving the recent list never deletes progress or corrections. Revisiting and completing a chapter can return an evicted course to Recent.
- Resume opens the last visited chapter in a new tab. The panel's Continue learning still opens the next incomplete chapter, wrapping to earlier unfinished chapters.

### Correcting a course

Use **Edit course** to rename the course or chapters, reorder with Up/Down, remove chapters, or add chapter links. Choose an alternative detected structure through its preview. **Reset to detected structure** previews a fresh list before Save changes commits it. Reset requires an available candidate on the actual website; the dashboard editor does not fetch websites.

Changes remain a draft until Save changes. Cancel discards them, and a failed save retains the draft. Chapter links must be HTTP/HTTPS URLs on the source's exact origin (scheme, host, and port), with no duplicate canonical URLs. Relative links and anchors work. A course requires 1–150 total chapters and subsections with titles and URLs.

Retained chapter URLs preserve IDs and progress through rename/reorder/reset. New URLs start incomplete. Removed completion flags remain stored. Saved corrections take precedence over future automatic detection. On an unsupported website, **Create course** opens an empty editor through the toolbar popup.

### Generic detection

The engine registers curriculum navigation, documentation navigation, and anchored article-section detectors. There are no website-specific detectors or host branches. Shared navigation extraction runs once, then detector modules produce scored candidates and evidence reasons. Ranking weights and thresholds live in `src/detection/policy.ts`.

Candidate evidence includes numbered chapters (including book-style 1. and 1.1.), semantic navigation, learning labels, URL coherence, and current-page membership. Generic/mixed navigation is penalized; a learning keyword alone is insufficient. Responsive/nested duplicate lists are deduplicated by canonical chapter targets. A strong cross-page sequence takes precedence over article sections. A single structurally valid candidate is used automatically, even below the ranking threshold; users can correct it through Edit course. Similarly ranked distinct candidates require user selection instead of an automatic guess. Ranking scores are not statistical confidence percentages.

The compatibility function `detectLearningStructure()` still returns the selected course or null. `detectLearningReport()` additionally exposes `detected`, `ambiguous`, or `unsupported`, candidates, and the selected result. `PageSnapshot` includes the report and resolved course.

## Hierarchical courses, notes, and bookmarks

- Expand/collapse parent chapters with keyboard-accessible buttons, or use Expand all / Collapse all. Both bulk controls return to the All filter. Nested lists and book-style numbering create subsections; article H3 headings belong to their preceding H2.
- Overall completion counts leaf topics only. Parents show completed/total topics and are complete when all their children are complete. Checking a parent checks its whole branch; unchecking clears that branch. Continue learning selects an incomplete leaf, including a subsection in the current chapter.
- Edit course offers a parent selector and Add subsection. Up/Down moves a whole branch among siblings. Removing a parent removes the branch from the definition while retaining its completion keys and annotations. Cyclic/missing parent relationships are rejected.
- Existing V2 course/chapter IDs and V1 completion keys stay compatible. An uncorrected detected definition can acquire hierarchy on a fresh scan; missing child flags inherit the nearest stored ancestor flag. Explicit child flags take precedence. Editing materializes inherited completion before reparenting/removing topics so their history stays intact. Manually added topics start incomplete, and re-added URLs recover stored completion. Corrected V2 courses stay corrected: use the detected-structure preview on the website to adopt a new hierarchy.
- Escape closes the notes view first; another Escape closes the floating panel. Clicking outside the floating panel dismisses it without stealing focus from the clicked page control. Dashboard editors dismiss on backdrop clicks. Closing notes (including Escape/outside dismissal) discards unsaved drafts; Save note persists them.
- Open a topic's pencil/star button to write a plain-text note (up to 20,000 characters) or toggle its bookmark. Notes use Save note; closing a dirty editor explicitly discards its draft. Failed saves retain the draft. Bookmarking does not save or discard a note draft and does not enroll the course in Saved/Recent.
- Bookmarks have a panel filter. My learning has a searchable Notes & bookmarks library, including annotations for unsaved courses or topics removed from a curriculum. Search note text, topic/course title, or website; open the original chapter/anchor or edit its annotation from the dashboard.
- Note/bookmark updates are serialized by the service worker and merge only the changed field. Other tabs update through storage events. A dirty note remains intact if another tab changes the stored note; the editor explains that saving will replace it. Last successful note save wins. Notes are rendered as text, not HTML.
- Definitions still use the backward-compatible `ll:v2:catalog`; optional `parentId` expresses the tree. Annotations use `ll:v3:annotation:<courseId>:<chapterId>` with note, bookmark, and a title/URL snapshot so removed topics remain accessible. All data stays local.

## Architecture and persistence

```text
src/
  background/    Serialized course metadata mutations and dashboard opening
  content/       DOM lifecycle, resolved snapshot, Shadow DOM floating panel
  popup/         Active-tab messaging and editor handoff
  dashboard/     Saved/recent library, search, resume, editing
  components/    Shared panel, course draft editor, and topic notes editor
  detection/     Generic candidate detectors, ranking policy, normalization
  storage/       Completion flags, versioned course metadata, resolution
  types/         Course, candidate/report, snapshot, metadata contracts
  utils/         Canonical URLs, stable IDs, tree ordering, progress aggregation, current/next selection
  demo/          Ordinary-browser preview with localStorage API shim
```

Detection is pure and synchronous. Storage owns progress. Content/popup/dashboard render the resolved definition. `chrome.storage.onChanged` updates open views. Structural DOM changes are debounced; scrolling and reminder timing do not rescan the DOM.

V1 `ll:v1:<courseId>:<chapterId>` completion keys remain unchanged. V2 metadata uses `ll:v2:catalog` and stores versioned definitions, saved/recent membership, corrections, activity, last visited URL, and explicit page selections. The service worker serializes metadata updates and reads fresh storage for each action; completion writes remain independent per chapter. Stored definitions resolve by explicit page choice, chapter membership, then source/original identity. Ambiguous stored matches require selection. Titles and reorder operations preserve captured IDs.

Historical V1 course names/URLs cannot be recovered from hashed completion keys, so old courses appear only after revisiting and completing or explicitly saving them. Uniquely matched unchanged chapter URLs retain identity after detected title changes. Arbitrary URL restructuring is not migrated.

## Preview and validation

```powershell
npm run dev
```

Open `http://127.0.0.1:5173/demo.html` for the interactive sample and `http://127.0.0.1:5173/dashboard.html` for its library. Ordinary-browser previews use localStorage and explicitly simulated course data; installed extension pages use Chrome APIs. The preview is not a substitute for the installed-extension test.

The Vitest suite covers V1 detection/progress behavior, generic domains, duplicate and competing structures, misleading navigation, anchors, unsafe links, metadata identity, recent eviction, saved transitions, corrections, manual source resolution, explicit selection, worker concurrency, failed writes, and the production content bundle with mocked Chrome APIs.

A real installed-extension smoke test is provided in `scripts/smoke-extension.cjs`. It requires an available Playwright package and its full Chromium browser (not only headless shell). If Playwright is provided externally, set `LEARNLAYER_PLAYWRIGHT_MODULE` to its package path; set `PLAYWRIGHT_BROWSERS_PATH` if its browser cache is elsewhere. Then run:

```powershell
node scripts/smoke-extension.cjs
```

The script loads `dist` into a newly created isolated temporary profile and serves deterministic local fixture pages. It does not access your personal Chrome profile. It tests completion → Recent → Save → edit/reorder/add → navigate → reload → Resume, live cross-tab updates, manual creation, invalid links, cancellation, candidate selection, reset preview, constrained viewport, and reopening the profile. This is deterministic fixture validation, not a live-site compatibility benchmark.

## Permissions and limits

`storage` persists local data; `activeTab` and `scripting` support user-triggered inspection/injection. HTTP/HTTPS content scripts provide automatic detection and the floating button. The service worker opens extension tabs, so content scripts do not need privileged tab APIs. Site access can be restricted in Chrome's extension settings. No new permissions were added for hierarchy, notes, or bookmarks.

- Support depends on accessible DOM structures, not every website. Canvas/iframe-only lessons and arbitrary card grids may be unsupported.
- Automatic navigation candidates require 3–150 useful links; manually created courses can have one chapter.
- Cross-origin chapters are excluded. Nested lists, contextual hierarchical numbering, and article H2/H3 headings provide hierarchy; unsupported or missing relationships can be corrected in the editor.
- Cross-page detected curricula are cached locally without Saved or Recent membership, allowing chapter pages to reuse the full course even before completion. A correction is a stored curriculum, not a selector that continually incorporates site changes; review/reset it when the site's curriculum changes.
- No network fetches, accounts, cloud sync, backup/import, cross-source paths, or destructive progress-reset feature.
- Protected Chrome pages, the Web Store, PDF viewer, and file URLs cannot be inspected. My learning remains available through the popup.
- Opt-in reminders use 45 seconds of visible-tab time plus document-bottom scrolling. They suggest completion and never mark it automatically; nested scrollers/video playback are not measured.
- Uninstalling or clearing extension storage removes local progress and metadata.

### V2 validation history

On October 6, 2026, `npm test` passed all 35 tests and the production build. The isolated installed-Chromium smoke test passed the flows above, including reopening the browser profile. The dashboard screenshot was visually inspected. Toolbar button interaction and its user-granted `activeTab` permission still need a manual Chrome check: opening `popup.html` as a background test tab does not grant that permission. The content-message editor handoff is covered, but the automated run does not claim to reproduce a real toolbar click. Live-site breadth, extraction accuracy, and performance have not been benchmarked.

A live Rust Book check also passed: the installed extension extracted all 111 sidebar entries, retained the same course identity between Getting Started and Installation, and preserved completion. Run `node scripts/check-rust.cjs` with the same Playwright environment settings to repeat it. Book-style numeric tables of contents are handled generically; article-section links inserted beneath a chapter are excluded when that chapter's page link is already present.

A live Python Tutorial check passed: the main-content nested index is recognized as a curriculum with 16 top-level chapters. Opening a chapter before completion retains the full tutorial; marking completion adds it to Recent and preserves progress on other chapters. This was chapter-level tracking in V2; V3 retains the index subsections as a hierarchy. Repeat this live check with `node scripts/check-python.cjs` using the same Playwright settings.

### V3 verification (October 7, 2026)

`npm test` passed 51 tests in ten files and the production build. The new installed-extension suite `node scripts/smoke-v3.cjs` passed V2-to-hierarchy migration, inherited completion, keyboard collapse/expand, leaf aggregation, notes/bookmarks, failed-save draft/retry, cross-tab note conflicts, anchor navigation, adding/removing subsections, annotation retention after removal, constrained layout, and reopening the isolated browser profile. The V2 installed-extension suite also passed. Panel/dashboard screenshots were inspected.

Live checks passed against the Python Tutorial (136 entries: 16 top-level chapters and 120 subsections) and Rust Book (111 entries, 25 top-level entries). Both retained course identity and progress across chapter navigation. Rust's temporary current-article-only contents are excluded from its curriculum. These two examples do not constitute a compatibility or accuracy benchmark.

Run the browser suites with the same external Playwright/browser environment described above:

```powershell
node scripts/smoke-v3.cjs
node scripts/check-python.cjs
node scripts/check-rust.cjs
```

The actual Chrome toolbar click/activeTab permission still needs a manual check. Backup/restore, cloud sync, and a detection benchmark remain outside this implementation.
