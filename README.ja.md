# ⛩️ コミケ サークル配置チェッカー & 同期拡張機能 (C108)

📖 [English Version](./README.md) | **日本語版**

X（Twitter）のコミケ告知ポストから**日程・館名・ブロック・スペース番地・サークル名・作者名・頒布価格・サンプル画像 URL**を自動抽出し、Google スプレッドシートやローカルストレージに保存・同期する Google Chrome & Mozilla Firefox 用 Manifest V3 拡張機能です。

---

## 🌟 主な機能

- **⚡ ポストから1クリック同期**: `MutationObserver` により X（Twitter）のタイムラインをリアルタイム監視し、コミケ告知ポスト上に `+ Track` ボタンを自動挿入します。
- **🗺️ 高精度な表記パースエンジン**: 日本語・英語の各種コミケ配置表記に完全対応：
  - **日程**: `1日目`, `2日目`, `土曜`, `日曜`, `(土)`, `(日)`, `㈯`, `㈰`, `8/15`, `8/16`
  - **館名・ブロック・スペース**: `東 ウ-11a`, `東1 ア-26ab`, `西1 め-58ab`, `南2 B-12b`
- **✏️ プレビュー＆優先度調整モーダル**: 保存前に優先度（`P1 最優先/壁`, `P2 一般/島`, `P3 予備/後回し`）、想定頒布価格（円）、メモをインライン調整可能です。
- **📊 予算・目標サークル数 自動集計**: 1日目・2日目ごとの目標サークル数と必要な想定現金購入予算（日本円）をポップアップ上でリアルタイム集計します。
- **📋 Google スプレッドシート 1クリック貼り付け (Ctrl+V)**: ポップアップの「Google シート用にコピー (Ctrl+V)」ボタンを押して、スプレッドシート上で `Ctrl + V` を押すだけで綺麗な表として貼り付け可能です。
- **🌐 多言語 UI (日本語 / 英語)**: ブラウザの言語設定に応じて `日本語 (English)` または `English (日本語)` 表示に自動切り替えされます。

---

## 📁 プロジェクト構造

```
ComiketPlanner/
├── manifest.json                  # Manifest V3 拡張機能仕様書
├── Code.gs                        # Google Apps Script Web App バックエンドコード
├── README.md                      # 英語版 マニュアル
├── README.ja.md                   # 日本語版 マニュアル
├── LICENSE                        # MIT ライセンス
├── _locales/                      # 多言語化 (i18n)
│   ├── en/messages.json           # 英語メッセージ
│   └── ja/messages.json           # 日本語メッセージ
├── icons/                         # 拡張機能アイコン
│   ├── generate_icons.js          # アイコン生成スクリプト
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── src/
│   └── utils/
│       ├── browser-poly.js        # クロスブラウザ API アダプター
│       ├── parser.js              # コミケ配置パースエンジン
│       └── exporter.js            # CSV / TSV クリップボード / JSON 出力
├── content/
│   ├── content.js                 # X (Twitter) DOM スキャナー＆モーダル表示
│   └── content.css                # モーダル＆UI スタイル
├── popup/
│   ├── popup.html                 # ポップアップ UI
│   ├── popup.js                   # 手動テキスト解析＆ページアナライザー
│   └── popup.css                  # ダークモードデザイン
├── options/
│   ├── options.html               # 設定ページ
│   ├── options.js                 # Web App URL＆表示設定
│   └── options.css                # 設定 UI スタイル
└── background/
    └── service-worker.js          # バックグラウンド処理
```

---

## 🌐 インストール手順

### 🌐 Google Chrome / Brave / Edge / Arc
1. ブラウザで `chrome://extensions/` を開きます。
2. 右上の **デベロッパー モード** をオンにします。
3. **パッケージ化されていない拡張機能を読み込む** をクリックします。
4. 本プロジェクトのフォルダ（`./ComiketPlanner`）を選択します。

### 🦊 Mozilla Firefox
1. Firefox で `about:debugging#/runtime/this-firefox` を開きます。
2. **一時的なアドオンを読み込む...** をクリックします。
3. 本プロジェクト直下の [`manifest.json`](file:///./manifest.json) ファイルを選択します。

---

## 🧪 使い方

1. **X（Twitter）でのサークル巡り**:
   - [x.com](https://x.com) でサークルの新刊告知や配置ポストを閲覧します。
   - ポスト内に配置情報（例: `C108 土曜 東モ-30a` や `(土)東１-ア26ab`）が含まれていると、ツイートカード上に `+ Track` ボタンが自動挿入されます。
   - `+ Track` をクリックしてモーダルを開き、優先度や価格を確認して **作戦シートに保存**（または **Save Circle**）をクリックします。

2. **手動クイック追加**:
   - 拡張機能ポップアップを開き、告知テキストを **クイック追加** タブに貼り付けると、自動的に解析されてリストに追加できます。

3. **Google スプレッドシートへのエクスポート**:
   - ポップアップの **`📋 Google シート用にコピー (Ctrl+V)`** をクリックします。Google スプレッドシートを開いて `Ctrl + V` を押すと、全サークル情報が列ごとに整理されて一発で貼り付けられます！
