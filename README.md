# ⛩️ Comiket Circle Tracker Sync Extension (C108)

Cross-browser (Chrome & Firefox) Manifest V3 extension designed to automate Comiket 108 circle hunt planning. It dynamically scans circle announcement posts on X (Twitter), extracts Day, Building, Block, Space, Circle Name, Artist, Price, and Sample Image URLs, and syncs them to your Google Sheet or local storage.

---

## 🌟 Key Features

- **⚡ 1-Click Tweet Sync**: Scans X (Twitter) feeds dynamically via `MutationObserver` and injects high-visibility `+ Track` badges on recognized Comiket circle posts.
- **🗺️ Intelligent Location Parser**: Automatically extracts Japanese/English Comiket formatting:
  - **Day**: `1日目`, `2日目`, `土曜`, `日曜`, `8/15`, `8/16`
  - **Building, Block & Space**: `東 ウ-11a`, `西1 A-01a`, `南2 C-05b`
- **✏️ Interactive Preview Modal**: Popup modal lets you review and tweak Priority (`P1 High`, `P2 Medium`, `P3 Low`), Estimated Price (JPY), and Notes before saving.
- **📊 Total Cash & Budget Estimator**: Calculates total Yen budget and count of target circles per day directly inside the extension popup.
- **🦊 Firefox & Chrome Compatibility**: Built using standard Manifest V3 WebExtension APIs and cross-browser polyfills.
- **🌐 Bilingual UI**: Automatically renders in `日本語 (English)` or `English (日本語)` depending on your browser environment.

---

## 📁 Project Structure

```
ComiketPlanner/
├── manifest.json                  # Manifest V3 extension specification
├── Code.gs                        # Google Apps Script Web App backend code
├── README.md                      # Setup guide & installation manual
├── _locales/                      # Internationalization (i18n)
│   ├── en/messages.json           # English localization
│   └── ja/messages.json           # Japanese localization
├── icons/                         # Extension icons
│   ├── generate_icons.js          # Pure Node.js PNG icon generator
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── src/
│   └── utils/
│       ├── browser-poly.js        # Chrome & Firefox cross-browser API adapter
│       ├── parser.js              # Comiket Japanese regex parser engine
│       └── exporter.js            # CSV, TSV clipboard & JSON exporter
├── content/
│   ├── content.js                 # X (Twitter) DOM scanner & UI overlay
│   └── content.css                # Glassmorphic overlay & modal styles
├── popup/
│   ├── popup.html                 # Extension popup interface
│   ├── popup.js                   # Manual text parser & live page inspector
│   └── popup.css                  # Dark mode design system
├── options/
│   ├── options.html               # Options & Settings page
│   ├── options.js                 # Web App URL & display preferences
│   └── options.css                # Settings UI styling
└── background/
    └── service-worker.js          # Ephemeral background dispatcher
```

---

## 🌐 Step 1: Load Extension in Your Browser

### 🌐 Google Chrome / Brave / Edge / Arc
1. Open `chrome://extensions/` in your browser.
2. Enable **Developer mode** toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the project directory: `./ComiketPlanner`.

### 🦊 Mozilla Firefox
1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on...**.
3. Select [`manifest.json`](file:///./manifest.json).

---

## 🧪 How to Use

1. **Browsing X (Twitter)**:
   - Go to [x.com](https://x.com) and search or browse circle announcements.
   - When a tweet contains Comiket location details (e.g. `C108 土曜 東モ-30a`), a `+ Track` button will appear right on the tweet card!
   - Click `+ Track` to open the preview popover, select priority and budget, then click **Save Circle**.

2. **Manual Add**:
   - Open the extension popup, paste tweet text or announcement URL into **Quick Add**, preview parsed details, and click **Save Circle to Plan**.

3. **1-Click Export to Google Sheets**:
   - Open the extension popup and click **`📋 Copy Table for Google Sheets`**. Open any Google Sheet and press **`Ctrl + V`** to paste the formatted table!
