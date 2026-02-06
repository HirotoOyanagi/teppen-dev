# TEPPEN 再実装プロジェクト

TEPPENの中核である「時間進行＋割り込み（Active Response）を持つ1vs1カードバトル」を、オリジナルIP・オリジナルカードで再実装するプロジェクトです。

## 技術スタック

- **Game Core**: TypeScript
- **Client**: Next.js (React)
- **Server**: Node.js + WebSocket (任意)
- **DB**: Supabase/PostgreSQL (任意)

## 開発環境

### セットアップ

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev

# 型チェック
npm run type-check

# ビルド
npm run build
```

## プロジェクト構造

```
teppen/
├── core/           # Game Core（ゲームエンジン）
│   ├── types.ts    # 型定義（State / Input / Event）
│   ├── engine.ts   # ゲームエンジン本体
│   ├── cards.ts    # サンプルカードデータ
│   └── index.ts    # エクスポート
├── pages/          # Next.js Pages Router
├── components/     # Reactコンポーネント
│   └── GameBoard.tsx  # ゲーム盤面UI
├── server/         # サーバー側コード（任意）
└── styles/         # スタイル
```

## 実装済み機能

- [x] 環境構築
- [x] 基本的な型定義（State / Input / Event）
- [x] ゲームエンジンの実装
- [x] Active Responseの詳細実装
- [x] ユニットの攻撃システム（交戦時の相互ダメージ）
- [x] 3レーン盤面システム
- [x] 両プレイヤーがカードをプレイ可能
- [x] MP回復システム（10秒で3MP）
- [x] ユニット攻撃間隔（10秒に1回）

## ゲームルール

- **MP回復**: 10秒で3MP回復（1秒あたり0.3MP）
- **ユニット攻撃**: 10秒に1回自動攻撃
- **盤面**: 3レーン（0, 1, 2）にユニットを配置可能
- **交戦**: 同じレーンに対面ユニットがいる場合、互いにダメージを与え合う
- **直接攻撃**: 正面にユニットがいない場合、相手のHPに直接ダメージ

## 参考

詳細な要件定義は `teppen.md` を参照してください。




