#!/bin/bash
set -a
source .env.production.local
set +a

gcloud run deploy esm-payment-tracker \
  --image=asia-northeast1-docker.pkg.dev/esmfinance/esm-payment-tracker/web:fe45ca3-authfix \
  --region=asia-northeast1 \
  --project=esmfinance \
  --allow-unauthenticated \
  --port=8080 \
  --set-env-vars="NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"
