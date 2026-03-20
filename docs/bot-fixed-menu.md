# Bot 固定メニュー設定 API

## 目的

Developer Console UI で固定メニューを直接編集できない場合に、サーバー経由で固定メニューAPIを呼び出して設定する。

## 追加済みエンドポイント

- `POST /api/v1/bot/fixed-menu`

## リクエスト

```json
{
  "botId": "11847478",
  "endpointPathTemplate": "/bots/{botId}/fixed-menu",
  "method": "POST",
  "buttonLabel": "日程調整を開始",
  "buttonUrl": "https://line-works-schedule.an.r.appspot.com/woff"
}
```

### 項目

- `botId`: 対象Bot ID
- `endpointPathTemplate`: LINE WORKS API パステンプレート（`{botId}` を含む）
- `method`: `POST` / `PUT` / `PATCH`
- `buttonLabel`: ボタン表示名
- `buttonUrl`: ボタン押下時URL
- `payload`(任意): API仕様に合わせた生ペイロードを直接渡す

## 実行例（PowerShell）

```powershell
$body = @{
  botId = "11847478"
  endpointPathTemplate = "/bots/{botId}/fixed-menu"
  method = "POST"
  buttonLabel = "日程調整を開始"
  buttonUrl = "https://line-works-schedule.an.r.appspot.com/woff"
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Method POST `
  -Uri "https://line-works-schedule.an.r.appspot.com/api/v1/bot/fixed-menu" `
  -ContentType "application/json" `
  -Body $body
```

## 仕様差分対応

固定メニューAPIのJSON仕様が環境差で異なる場合は、`payload` をリクエストに含めて生データをそのまま送信する。
