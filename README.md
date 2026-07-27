# College Helper — Browser Extension

Stores your college application details **locally in your browser** (never
on the internet, never on any server) and lets you:

1. **Copy** any single field's value with one click.
2. **Autofill** an entire application form in one click (smart matching).
3. **Manually point-and-click** to fill a field the smart matcher misses.
4. **Add your own custom fields** any time a form asks for something not
   already covered.

Works in **Chrome, Edge, and Brave** (all Chromium-based, same code, no
separate builds needed).

---

## 1. Install it (Load Unpacked — takes 30 seconds)

No build step, no npm install — it's plain HTML/CSS/JS.

1. Open your browser and go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Turn on **Developer mode** (toggle, usually top-right).
3. Click **"Load unpacked"**.
4. Select the `college-helper-extension` folder (this folder).
5. Done — the graduation-cap icon appears in your toolbar. Pin it for
   easy access (click the puzzle-piece icon → pin).

## 2. First use

Click the icon. Since no data exists yet, you'll see the setup screen.
Fill in whatever you already have (everything is optional — you can add
more later), then **Save & Get Started**.

## 3. Everyday use

- **Copy a value**: click the field's grey **Copy** button → it flips to
  **✓ Copied!** for a second, then the value is on your clipboard.
- **Autofill a whole form**: open the college's application form, click the
  extension icon, then **⚡ Autofill this page**. It scans the page's
  fields and fills whatever it can confidently match.
- **Fill one field manually**: if a field wasn't matched, click its 🎯
  button, then click the actual box on the page you want it typed into.
- **Search**: use the search bar (or `Ctrl+F` while the popup is open) to
  jump straight to a field in a long list.
- **Edit Details**: opens the full form, pre-filled, to update anything.
- **+ Add Field**: add a brand-new field (e.g. "Scholarship ID",
  "Portfolio Link") — give it a name, pick a section and type, optionally
  add a few keyword hints so autofill can find it on future forms, then
  it immediately opens for you to fill in its value.
- **Reset (⟲ icon, top-right)**: wipes everything, with a confirmation
  prompt first, in case you want to start fresh.

## 4. Data & privacy

- All data lives in `chrome.storage.local` — a private storage area tied
  to your browser profile on this device only.
- The extension makes **zero network requests**. There is no server,
  no analytics, no sync.
- Uninstalling the extension deletes the stored data permanently, so
  consider using **Edit Details → copy out important info** if you ever
  plan to uninstall and want a backup first (a JSON export/import button
  is a natural v2 addition if you'd like one later).

## 5. Sharing this with someone else (e.g. a sibling, friend)

Since it's just a folder of plain files, sharing is simple:

**Option A — Zip and send**
1. Zip the whole `college-helper-extension` folder.
2. Send the `.zip` (WhatsApp, email, Drive, USB — anything).
3. They unzip it and follow **Section 1** above ("Load unpacked") on
   their own browser.

**Option B — Publish to the Chrome Web Store** (only if you want it
public/searchable, optional and not required for personal/family use)
1. Zip the folder's *contents* (not the folder itself — the zip's top
   level should contain `manifest.json` directly).
2. Create a one-time Chrome Web Store developer account
   (~$5 registration fee, at https://chrome.google.com/webstore/devconsole).
3. Upload the zip, fill in the listing details, submit for review.
4. Once approved, anyone can install it with one click from the store —
   no "Developer mode" needed on their end.

For friends/family, **Option A is simpler and plenty** — there's no real
benefit to publishing publicly for a personal tool like this.

## 6. Project structure

```
college-helper-extension/
│
├── manifest.json              # Extension config (Manifest V3)
├── popup/
│   ├── popup.html             # Popup UI structure
│   ├── popup.css              # Styling (light + dark mode)
│   └── popup.js                # All popup logic
├── content/
│   └── content-script.js      # Runs on pages: smart autofill + manual fill
├── shared/
│   ├── constants.js           # Field schema (31 default fields + groups)
│   ├── storage.js             # All chrome.storage.local read/write logic
│   ├── utils.js                # Shared helpers (matching, debounce, etc.)
│   └── background.js          # Minimal MV3 service worker
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 7. Possible future additions (not built yet, easy to bolt on)

- Export/Import as a `.json` file (manual backup, or moving to a new
  computer without re-typing everything).
- A right-click context menu entry ("Fill with College Helper") as an
  alternative to opening the popup.
- Per-field "last used on [site]" memory, to auto-suggest which saved
  value fits an ambiguous field.
- An options page to reorder fields or rename section groups.
