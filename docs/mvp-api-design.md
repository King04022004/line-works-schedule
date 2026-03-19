# LINE WORKS 日程候補表示・予定登録システム MVP API設計書

最終更新日: 2026-03-18

## 1. 目的

WOFF 画面から以下を実現するためのバックエンド API を定義する。

- 複数メンバーの共通空き時間候補を取得する
- 候補を選択して確認する
- 登録直前に再判定し、予定を登録する

## 2. システム境界

- フロント: WOFF
- バックエンド: 本API（Node.js/TypeScript想定）
- 外部API:
  - LINE WORKS Directory API（メンバー・グループ）
  - LINE WORKS Calendar API（予定取得・予定作成）

## 3. 前提

- 認証済みユーザーの ID（`actorUserId`）をバックエンドで取得できる
- LINE WORKS API 呼び出しに必要な資格情報は `.env` で管理する
- 時刻は API 内部では ISO 8601（JST, `+09:00`）で扱う

## 4. API一覧（MVP）

### 4.1 メンバー検索

`GET /api/v1/members`

- 目的: 参加者候補を表示する
- クエリ:
  - `q` (任意): 部分一致検索キーワード
  - `limit` (任意, 初期値 20, 最大 100)
- レスポンス:

```json
{
  "items": [
    {
      "id": "u123",
      "name": "山田 太郎",
      "email": "taro@example.com"
    }
  ]
}
```

### 4.2 グループ一覧

`GET /api/v1/groups`

- 目的: グループ経由で参加者選択する
- クエリ:
  - `q` (任意)
  - `limit` (任意, 初期値 20, 最大 100)

### 4.3 グループメンバー取得

`GET /api/v1/groups/:groupId/members`

- 目的: 選択グループのメンバー展開

### 4.4 候補検索

`POST /api/v1/availability/search`

- 目的: 共通空き時間候補を算出
- リクエスト:

```json
{
  "actorUserId": "u001",
  "participantUserIds": ["u001", "u002", "u003"],
  "durationMinutes": 30,
  "range": {
    "from": "2026-03-18T00:00:00+09:00",
    "to": "2026-03-25T00:00:00+09:00"
  },
  "options": {
    "businessHours": { "start": "09:00", "end": "18:00" },
    "excludeWeekends": true,
    "resultLimit": 5
  }
}
```

- バリデーション:
  - `participantUserIds` は重複除去後 2名以上
  - `durationMinutes` は `30` または `60`
  - `range` は最大 7日
  - 現在時刻から 30分以内に開始する候補は除外

- レスポンス:

```json
{
  "candidates": [
    {
      "candidateId": "cand_20260319_1000_1030",
      "start": "2026-03-19T10:00:00+09:00",
      "end": "2026-03-19T10:30:00+09:00",
      "participantUserIds": ["u001", "u002", "u003"]
    }
  ],
  "total": 1
}
```

### 4.5 登録前確認（再判定）

`POST /api/v1/availability/recheck`

- 目的: 候補選択後、登録直前に競合チェック
- リクエスト:

```json
{
  "participantUserIds": ["u001", "u002", "u003"],
  "start": "2026-03-19T10:00:00+09:00",
  "end": "2026-03-19T10:30:00+09:00"
}
```

- レスポンス:

```json
{
  "available": true,
  "conflicts": []
}
```

### 4.6 予定登録

`POST /api/v1/events`

- 目的: 候補を予定として作成
- リクエスト:

```json
{
  "actorUserId": "u001",
  "calendarId": "u001",
  "title": "打ち合わせ_山田_佐藤_鈴木",
  "start": "2026-03-19T10:00:00+09:00",
  "end": "2026-03-19T10:30:00+09:00",
  "participantUserIds": ["u001", "u002", "u003"],
  "idempotencyKey": "cand_20260319_1000_1030_u001"
}
```

- 処理:
  - 直前再判定（4.5相当）をサーバー内部でも必ず実施
  - 空きでなければ `409 Conflict`
  - 登録成功時、作成イベント ID を返す

- レスポンス:

```json
{
  "eventId": "evt_98765",
  "status": "created"
}
```

## 5. エラー設計

共通エラー形式:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "durationMinutes must be 30 or 60",
    "details": {}
  }
}
```

主要コード:

- `VALIDATION_ERROR` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `CONFLICT` (409): 再判定で空きでなくなった
- `RATE_LIMITED` (429)
- `INTEGRATION_ERROR` (502): LINE WORKS API 呼び出し失敗
- `INTERNAL_ERROR` (500)

## 6. 空き時間判定ロジック（MVP）

1. 期間内の営業日・営業時間スロットを生成
2. 各参加者の予定を Calendar API から取得
3. 予定区間を busy としてマージ
4. 全員の free 区間の積集合を計算
5. `durationMinutes` 以上の候補を抽出
6. 現在+30分未満開始の候補を除外
7. 開始時刻昇順で `resultLimit` 件返却

## 7. 重複登録防止

- `idempotencyKey` を必須にする
- 同一キーの短時間再送を重複作成しない
- 実装方式:
  - 初期はメモリキャッシュ（MVP）
  - 将来は Redis/DB へ移行

## 8. WOFF 画面との対応

- 画面1（候補検索）:
  - `GET /members`, `GET /groups`, `GET /groups/:id/members`, `POST /availability/search`
- 画面2（候補結果）:
  - `POST /availability/search`
- 画面3（登録確認）:
  - `POST /availability/recheck`, `POST /events`

## 9. `.env` 項目（案）

```env
PORT=3000
NODE_ENV=development
TZ=Asia/Tokyo

# LINE WORKS
LW_API_BASE_URL=
LW_AUTH_BASE_URL=
LW_CLIENT_ID=
LW_CLIENT_SECRET=
LW_SCOPE_DIRECTORY=
LW_SCOPE_CALENDAR=
LW_SERVICE_ACCOUNT_ID=
LW_PRIVATE_KEY=

# Availability
DEFAULT_RANGE_DAYS=7
DEFAULT_RESULT_LIMIT=5
BUSINESS_HOUR_START=09:00
BUSINESS_HOUR_END=18:00
EXCLUDE_WEEKENDS=true
MIN_LEAD_MINUTES=30
```

## 10. 実装フェーズ（次アクション）

1. バックエンド雛形作成（TypeScript + APIルーティング）
2. `POST /availability/search` をモックデータで先行実装
3. WOFF 画面雛形（検索/結果/確認）
4. LINE WORKS API クライアント接続
5. `POST /events` の再判定 + 作成実装
6. 受け入れ条件に沿ったテスト整備
