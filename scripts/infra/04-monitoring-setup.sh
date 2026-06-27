#!/usr/bin/env bash
# Create Cloud Monitoring TCP uptime check on port 5432, email notification
# channel, and alert policy for the hop-db VM.
# Run from your local machine after Task 1 (VM and static IP must exist).

set -euo pipefail

PROJECT="hop-ahumado-prod-492215"
EMAILS=("sirifacu97@gmail.com" "sirifacu@gmail.com" "federicosiri9@gmail.com")
REGION="us-central1"
IP_NAME="hop-db-ip"

VM_IP=$(gcloud compute addresses describe "$IP_NAME" \
  --region="$REGION" --project="$PROJECT" --format="value(address)")

echo "==> VM static IP: $VM_IP"

TOKEN=$(gcloud auth print-access-token)
BASE="https://monitoring.googleapis.com/v3/projects/${PROJECT}"

echo "==> Creating TCP uptime check on port 5432"
UPTIME_RESPONSE=$(curl -sf -X POST \
  "${BASE}/uptimeCheckConfigs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"displayName\": \"hop-db Postgres TCP\",
    \"tcpCheck\": {\"port\": 5432},
    \"monitoredResource\": {
      \"type\": \"uptime_url\",
      \"labels\": {
        \"host\": \"${VM_IP}\",
        \"project_id\": \"${PROJECT}\"
      }
    },
    \"period\": \"60s\",
    \"timeout\": \"10s\"
  }")

UPTIME_NAME=$(echo "$UPTIME_RESPONSE" | python3 -c \
  "import json,sys; print(json.load(sys.stdin)['name'])")
echo "Uptime check: $UPTIME_NAME"

echo "==> Creating email notification channels"
CHANNEL_NAMES=()
for EMAIL in "${EMAILS[@]}"; do
  CHANNEL_RESPONSE=$(curl -sf -X POST \
    "${BASE}/notificationChannels" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"email\",
      \"displayName\": \"hop-db alert (${EMAIL})\",
      \"labels\": {\"email_address\": \"${EMAIL}\"}
    }")
  CHANNEL_NAME=$(echo "$CHANNEL_RESPONSE" | python3 -c \
    "import json,sys; print(json.load(sys.stdin)['name'])")
  CHANNEL_NAMES+=("\"${CHANNEL_NAME}\"")
  echo "  Channel: $CHANNEL_NAME"
done

CHANNELS_JSON=$(IFS=,; echo "${CHANNEL_NAMES[*]}")

echo "==> Creating alert policy (fires after 2 consecutive failures)"
curl -sf -X POST \
  "${BASE}/alertPolicies" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"displayName\": \"hop-db Postgres down\",
    \"conditions\": [{
      \"displayName\": \"TCP check failing\",
      \"conditionThreshold\": {
        \"filter\": \"resource.type=\\\"uptime_url\\\" AND metric.type=\\\"monitoring.googleapis.com/uptime_check/check_passed\\\"\",
        \"comparison\": \"COMPARISON_LT\",
        \"thresholdValue\": 1,
        \"duration\": \"120s\",
        \"aggregations\": [{
          \"alignmentPeriod\": \"60s\",
          \"perSeriesAligner\": \"ALIGN_NEXT_OLDER\",
          \"crossSeriesReducer\": \"REDUCE_COUNT_FALSE\"
        }]
      }
    }],
    \"notificationChannels\": [${CHANNELS_JSON}],
    \"alertStrategy\": {\"autoClose\": \"604800s\"},
    \"enabled\": true
  }" > /dev/null

echo ""
echo "==> Monitoring setup complete."
echo ""
echo "Verify:"
echo "  gcloud alpha monitoring uptime list-configs --project=$PROJECT"
echo ""
echo "Test: stop Postgres on VM, wait ~3 min, check email."
echo "  gcloud compute ssh hop-db --zone=us-central1-a -- sudo systemctl stop postgresql@16-main"
