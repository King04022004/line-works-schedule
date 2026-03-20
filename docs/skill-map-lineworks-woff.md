# LINE WORKS 日程調整システム スキル図（運用メモ）

このドキュメントは、今後 LINE WORKS（WOFF / Bot / Calendar API）で機能追加するときに再利用するための「スキル図」です。

## 1. スキル図（全体）

```mermaid
flowchart TD
  A[LINE WORKS Bot 固定メニュー] --> B[WOFF URL /woff]
  B --> C[候補検索UI]
  C --> D[/api/v1/members]
  C --> E[/api/v1/availability/search]
  C --> F[/api/v1/availability/recheck]
  C --> G[/api/v1/events]

  E --> H[Service Account Token]
  F --> H
  D --> H
  H --> I[LINE WORKS Directory/Calendar Read API]

  G --> J[User OAuth Token]
  J --> K[/api/v1/auth/login -> callback]
  G --> L[LINE WORKS Calendar Create API]
```

## 2. 今回確立した実装ルール

- 候補検索系（`/members`, `/availability/search`, `/availability/recheck`）:
  - Service Account トークンで実行
- 予定登録（`/events`）:
  - User OAuth ログイン必須
- 登録先カレンダー:
  - UI上は固定（`me`）
  - ユーザーに編集させない
- 固定メニュー:
  - Developer Console 画面だけでは編集しきれない場合あり
  - API で persistent menu を登録

## 3. 主要エンドポイント（実装済み）

- `GET /woff`
- `GET /health`
- `GET /api/v1/members`
- `POST /api/v1/availability/search`
- `POST /api/v1/availability/recheck`
- `POST /api/v1/events`
- `GET /api/v1/auth/login`
- `GET /api/v1/auth/callback`
- `GET /api/v1/auth/status`
- `POST /api/v1/bot/fixed-menu`

## 4. GAE運用スキル（最短）

1. ローカルで修正
2. `git add` / `git commit` / `git push`
3. Cloud Shell:
   - `cd ~/line-works-schedule`
   - `git pull`
   - `gcloud app deploy`

認証切れ時:

- `gcloud auth login`
- `gcloud config set account <your-account>`
- `gcloud config set project line-works-schedule`

## 5. ハマりどころ（再発防止）

- Private Key は `.env` / `app.yaml` で改行扱いに注意（`\n` 形式か Secret Manager 推奨）
- Calendar API パス差異:
  - Busy: `fromDateTime` / `untilDateTime`
- userId 不一致で `NOT_EXIST_USER`
  - Directory の `id` は実ユーザーID（ログインID）を使う
- Service Account で作成不可の場合がある
  - `/events` は User OAuth にフォールバック
- Botメニュー:
  - `persistentmenu` の path/method/payload はテナント仕様差異あり
- UIの名前表示:
  - WebView キャッシュが強い場合あり
  - JS/CSS version query + no-store で回避

## 6. UI/UX スキル（今回の確定版）

- 初回ログインモーダル
  - 未ログイン時のみ表示
- ログイン済みは再ログインボタンのみ
- メンバー選択:
  - 検索 + チェックボックス
- 表示:
  - 名前のみ（ID/メールは画面非表示）
- 候補カード:
  - 日時を見やすい形式で表示
- 登録成功時:
  - 完了モーダル表示

## 7. 次回機能追加テンプレート（LIFF/WOFF拡張時）

1. 追加ユースケースを定義（入力/出力/失敗時）
2. API責務を分割
   - 読み取り系（SA）
   - 書き込み系（OAuth）
3. UIに「初回導線」「失敗導線」「成功フィードバック」を先に置く
4. Bot導線（固定メニュー or メッセージ導線）を最後に接続
5. GAEへ反映し、WOFF実機で確認

## 8. 用語整理（誤解防止）

- LINE WORKS の Web アプリ導線は `WOFF`
- LINE の `LIFF` とは別概念
- 今回の実装は WOFF ベースで運用

