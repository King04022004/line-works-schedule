# LINE WORKS 日程調整システム 運用ガイド

最終更新: 2026-03-19

## 1. 本番構成

- 本番URL: `https://line-works-schedule.an.r.appspot.com`
- WOFF画面: `https://line-works-schedule.an.r.appspot.com/woff`
- OAuthコールバック:
  - `https://line-works-schedule.an.r.appspot.com/api/v1/auth/callback`
- ホスティング: Google App Engine (GAE)

## 2. 利用導線

- LINE WORKSのBotメニューからWOFF URLを起動
- 画面操作:
  1. 候補検索
  2. 登録前再判定
  3. 予定登録

## 3. 日常運用

### 3.1 サーバー起動について

- GAEは常時稼働のため、ローカルで `npm run dev` は不要
- 本番更新時のみ `gcloud app deploy` を実施

### 3.2 日次確認（推奨）

1. `GET /health` で応答確認
2. `GET /api/v1/auth/status` で認証導線確認
3. 実ユーザー2名で検索・登録の疎通確認

## 4. リリース手順

1. ローカルで修正
2. GitHubへpush
3. Cloud Shellで以下を実行

```bash
cd ~/line-works-schedule
git pull
gcloud app deploy
```

4. 必要に応じてLINE WORKS Developer Console設定を更新
  - Redirect URL
  - WOFF URL

## 5. LINE WORKS 側設定

ClientAppで以下を設定する:

- OAuth Scopes:
  - `calendar`
  - `calendar.read`
  - `directory`
  - `directory.read`
- Redirect URL:
  - `https://line-works-schedule.an.r.appspot.com/api/v1/auth/callback`
- WOFF Endpoint URL:
  - `https://line-works-schedule.an.r.appspot.com/woff`

Botメニュー経由でWOFFを起動する運用を推奨。

## 6. 注意事項（重要）

1. `Client Secret` / `Private Key` は機密情報
2. 漏えいが疑われる場合は即ローテーション（再発行）
3. スコープ変更・権限変更後は再同意が必要
   - `GET /api/v1/auth/login`
4. OAuth状態はサーバー再起動・再デプロイで切れる可能性あり（現状メモリ保持）

## 7. 障害時の確認ポイント

1. `gcloud app logs tail -s default` でアプリログ確認
2. Cloud Build失敗時:
   - `gcloud builds log --region=asia-northeast1 --stream <BUILD_ID>`
3. IAM権限エラー時:
   - App Engine SA / Cloud Build SA の権限確認
4. LINE WORKS APIエラー時:
   - Scope
   - Redirect URL
   - User権限
   - APIパス/リクエスト形式

## 8. 今後の改善候補

1. 機密情報を Secret Manager へ移行
2. OAuthトークンをDB/Redisで永続化
3. 監査ログ（登録実績）追加
4. 監視とアラート（Cloud Logging / Error Reporting）導入
