# mind_dist · Latticework 65 商業心智模型庫

> 跨學科心智模型知識庫＋網站＋Obsidian vault。65 種模型 · 7 大學科 · 一般商業視角。
> 致敬 Charlie Munger 的「latticework of mental models」思想。

## 目錄結構

```
mind_dist/
├── README.md                    ← 你在這裡
├── source/                      ← 原始素材抓取
│   ├── munger_latticework.html
│   └── munger_latticework.txt
├── spec/                        ← 內容規範（SSOT）
│   ├── CARD_FORMAT.md           ← 卡片格式規範
│   └── MANIFEST.md              ← 65 張卡片索引
├── vault/                       ← Obsidian 知識庫
│   ├── README.md                ← MOC（Map of Content）
│   ├── _disciplines/            ← 7 個學科總覽頁
│   └── models/                  ← 65 張獨立卡片 .md
├── data/
│   └── models.json              ← 由 vault 產生，給 site 使用
├── scripts/
│   └── build_json.py            ← 從 vault 重新生成 models.json
└── site/                        ← 商業形象網站（暖灰乳白色調）
    ├── index.html
    ├── styles.css
    └── app.js
```

## 三種使用方式

### 1. 用 Obsidian 深度閱讀
把 `vault/` 資料夾以 Obsidian Vault 開啟。每張卡都是獨立檔案，模型彼此以 `[[wikilink]]` 連結。在 Graph View 可以看到整張跨學科網。

### 2. 用網站快速瀏覽
在專案根目錄啟動本機伺服器：
```bash
cd "$(pwd)" && python3 -m http.server 8000
```
瀏覽器打開 `http://localhost:8000/site/` 即可。

特色：
- 暖乳白底色、深栗色 accent，類似《經濟學人》《哈佛商業評論》質感
- 七大學科篩選 + 全文搜尋（⌘K）
- 點卡片開啟完整內容（modal）
- 卡片下方有相關模型導引

### 3. 從原始 vault 重新產生網站資料
若編輯了 vault 內的 `.md` 卡片，執行：
```bash
python3 scripts/build_json.py
```
這會把 `vault/models/*.md` 重新解析、轉成 HTML 並輸出 `data/models.json`。

## 卡片結構

每張卡都依下列順序撰寫：

1. **一句話定義**（40 字內）
2. **核心原理**（運作機制與邊界）
3. **為什麼商業上重要**
4. **商業應用場景**（4 個）
5. **經典個案剖析**（主案例 200–280 字 + 1–2 延伸案例）
6. **實務啟示**（4 條）
7. **常見陷阱**
8. **延伸思考**（2 題）
9. **相關模型**（含跨學科 wikilinks）

長度：800–1300 繁中字 / 卡。

## 設計取向

- **商業視角優先**：所有模型以一般商業視角（經理人/創業者/投資人/產品負責人）撰寫
- **個案具體**：每張卡都配真實商業/歷史案例，避免空泛
- **跨學科連結**：每張卡的 `related` 至少有一個跨學科 wikilink
- **語氣克制成熟**：類似 The Economist / HBR / Munger 演講風格
- **繁體中文，台灣用語**

## 七大學科

| 學科 | 模型數 | 編號範圍 |
|---|---:|---|
| 經濟學 | 28 | 01–28 |
| 心理學 | 12 | 29–40 |
| 物理學與系統 | 8 | 41–48 |
| 生物學與演化 | 4 | 49–52 |
| 統計學 | 5 | 53–57 |
| 工程學 | 3 | 58–60 |
| 哲學與邏輯 | 5 | 61–65 |
| **合計** | **65** | |

## 致謝

- 學科分類與模型選擇基於 Charlie Munger 公開倡導的「latticework of mental models」框架
- 內容皆為一般商業教育用途，由本專案重新撰寫
