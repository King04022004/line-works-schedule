# GAE Deploy Guide (MVP)

## 1. Prerequisites

- Google Cloud project
- Billing enabled
- `gcloud` CLI installed and logged in
- LINE WORKS credentials ready

## 2. Initial GCP setup

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud app create --region=asia-northeast1
gcloud services enable appengine.googleapis.com cloudbuild.googleapis.com
```

## 3. Set LINE WORKS secrets in `app.yaml`

Edit `app.yaml` and set:

- `LW_CLIENT_ID`
- `LW_CLIENT_SECRET`
- `LW_SERVICE_ACCOUNT`
- `LW_PRIVATE_KEY` (single-line with `\n` escapes)

Also update:

- `LW_OAUTH_REDIRECT_URI` to your deployed host

## 4. Deploy

```bash
gcloud app deploy
```

After deploy:

```bash
gcloud app describe --format="value(defaultHostname)"
```

Host example:

`YOUR_PROJECT_ID.an.r.appspot.com`

## 5. LINE WORKS side update

In LINE WORKS Developer Console ClientApp:

- Redirect URL:
  - `https://YOUR_HOST/api/v1/auth/callback`
- WOFF app URL:
  - `https://YOUR_HOST/woff`

## 6. Verify

1. `https://YOUR_HOST/health`
2. `https://YOUR_HOST/api/v1/auth/login`
3. open `https://YOUR_HOST/woff`
4. Search -> Recheck -> Create Event
