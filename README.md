# line-works-schedule

LINE WORKS 日程候補表示・予定登録システム（MVP）のバックエンド雛形です。

## セットアップ

```bash
npm install
cp .env.example .env
npm run dev
```

## LINE WORKS 実接続

1. `.env` に以下を設定
   - `LW_USE_MOCK=false`
   - `LW_API_BASE_URL`
   - `LW_AUTH_TOKEN_URL`
   - `LW_CLIENT_ID`
   - `LW_CLIENT_SECRET`
   - `LW_SERVICE_ACCOUNT`
   - `LW_OAUTH_REDIRECT_URI`
   - `LW_OAUTH_SCOPES`
   - `LW_PRIVATE_KEY` または `LW_PRIVATE_KEY_PATH`
   - 必要時のみ `LW_CALENDAR_BUSY_PATH_TEMPLATE`, `LW_CALENDAR_CREATE_PATH_TEMPLATE`
2. `npm run dev` で起動
3. ブラウザで `http://localhost:3000/api/v1/auth/login` を開いてログイン許可
4. `GET /api/v1/auth/status` が `loggedIn=true` になったら `POST /api/v1/events` 実行

注意:
- 認証情報は `.env` にのみ保持し、Git管理しないでください。
- 一度会話に貼り付けた秘密情報は漏えい扱いとして再発行を推奨します。
- APIパスがテナント設定で異なる場合、`*_PATH_TEMPLATE` で吸収できます。
- Calendar候補取得は環境により `fromDateTime` / `toDateTime` クエリ名が必要です（既定値対応済み）。

## エンドポイント

- `GET /health`
- `GET /woff` (WOFF向けUI)
- `GET /api/v1/members`
- `GET /api/v1/groups`
- `GET /api/v1/groups/:groupId/members`
- `POST /api/v1/availability/search`
- `POST /api/v1/availability/recheck`
- `POST /api/v1/events`

## WOFF画面の使い方

1. サーバー起動後、`http://localhost:3000/woff` を開く
2. 必要なら先に `http://localhost:3000/api/v1/auth/login` でOAuthログイン
3. 画面上でメンバー・所要時間を設定して候補検索
4. 候補を選んで「この内容で登録」

詳細仕様: `docs/mvp-api-design.md`

## 注意

- 現在は LINE WORKS 実API未接続のモック実装です。
- 実接続は `LW_USE_MOCK=false` にすると `src/integrations/lineworks.client.ts` が使われます。
