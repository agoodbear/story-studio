# 📸 IG 限動排版工作室 (story-studio)

點選式的 Instagram 限時動態（9:16 / 1080×1920）排版工具。上傳照片 → 選風格＋版面 → 即時預覽 → 匯出 PNG。純前端靜態網頁，手機/電腦都能用。

## 功能
- **上傳**：拖曳或點選，支援 HEIC / JPG。自動**修正 EXIF 方向**（不會貼歪）＋讀拍攝時間**自動排序**。
- **8 種風格**：拍立得白框 / 簡約雜誌 / 底片膠卷 / 急診數據風 / 極簡白底 / 粗體標語 / 漸層卡 / 質感暗黑。
- **4 種版面**：單張滿版 / 雙圖分割 / 3 格拼貼 / 4 格拼貼。
- **多頁故事**：可分多頁，「✨ 自動排版」把照片依時間切成多頁。
- **可編輯文字**：主標 / 副標(手寫) / 標籤 / 日期戳記。
- **匯出**：單頁或全部，輸出 1080×1920 JPG。

## 技術
- 純靜態（無框架，避開中文路徑 build 問題），`index.html` + `app.js` + `styles.css`。
- `exifr`（讀 EXIF）、`heic2any`（HEIC→JPEG）、`html-to-image`（輸出 PNG）皆走 CDN。
- 照片以 `createImageBitmap({imageOrientation:'from-image'})` 轉正，從源頭根治旋轉問題。

## 發布到 IG
匯出 PNG 後，交給 `ig-bot`（`../ig-bot/publish.py --story --image <url>`）發到 ecg_bear 限動。
（依草稿優先原則：生成 → Bear 確認 → 才發。）
