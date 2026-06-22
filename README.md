# Lite2D

Lite2D は、PNG パーツを読み込んで簡易メッシュ変形を付け、スプライトシートとして書き出すための React + Pixi.js 製 MVP エディタです。

## 主な機能

- PNG パーツの複数読み込み
- パーツの表示切り替えと描画順の調整
- 512x512 キャンバス上での Pixi.js メッシュ表示
- 頂点ドラッグによるメッシュ変形
- `ParamDeform` パラメータの値 `0` / `1` に対するキーフォーム保存
- 1 秒、12 fps の簡易アニメーション再生
- PNG スプライトシートと JSON メタデータの書き出し

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

Vite の表示する URL をブラウザで開いてください。ローカルで明示的にホストを固定したい場合は次のように起動できます。

```bash
npm run dev -- --host 127.0.0.1
```

## 使い方

1. 左側の `Parts` パネルから PNG ファイルを読み込みます。
2. パーツ一覧で編集したいパーツを選択します。
3. キャンバス上のメッシュ頂点をドラッグして形を調整します。
4. `Parameters` パネルで `ParamDeform` の値を切り替えながら、`Save value=0` または `Save value=1` で変形状態を保存します。
5. `Timeline` パネルの `Play` / `Stop` で変形アニメーションを確認します。
6. 右上の `Export PNG SpriteSheet + JSON` から `spritesheet.png` と `spritesheet.json` を書き出します。

## サンプル

透明 PNG の確認用サンプルが `samples/` に入っています。

- `samples/base.png`
- `samples/object.png`

これらは透明領域を含むため、PNG 読み込みや Pixi メッシュ描画を変更したときの回帰確認に使えます。

## ビルド

```bash
npm run build
```

TypeScript のビルドと Vite の本番ビルドを実行します。

## E2E テスト

```bash
npm run test:e2e
```

Playwright が Vite 開発サーバーを起動し、サンプル PNG の読み込み、メッシュ表示、キャンバスピクセルの検証などを行います。

初回などで Chromium が未インストールの場合は、次を一度だけ実行してください。

```bash
npx playwright install chromium
```

## プロジェクト構成

```text
src/
  app/          アプリ全体のレイアウト
  animation/    パラメータアニメーションの評価
  editor/       Zustand ストアと型定義
  mesh/         メッシュ生成と頂点ヒットテスト
  project/      PNG パーツのインポート、プロジェクト保存/読み込み
  render/       Pixi.js 表示、変形評価、書き出し
  ui/           パネル UI
tests/          Playwright E2E テスト
samples/        透明 PNG サンプル
```

## 開発メモ

PNG インポート、メッシュ生成、Pixi 描画、エディタ状態、ファイル入力まわりを変更した場合は、透明 PNG サンプルが白い四角として描画されないことを確認してください。

推奨確認:

```bash
npm run build
npm run test:e2e
```
