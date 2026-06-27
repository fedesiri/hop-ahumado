#!/usr/bin/env bash
# Set up GCS backup bucket, VM service account, and deploy backup cron.
# Run from your local machine after Task 1 and 2 are complete.
#
# What this does:
#   1. Creates GCS bucket hop-ahumado-db-backups with 7-day lifecycle
#   2. Creates hop-db-backup service account with bucket write access
#   3. Attaches the SA to the VM (requires brief VM stop/start)
#   4. Copies backup.sh to VM and installs the daily cron

set -euo pipefail

PROJECT="hop-ahumado-prod-492215"
ZONE="us-central1-a"
REGION="us-central1"
VM_NAME="hop-db"
BUCKET="hop-ahumado-db-backups"
SA_NAME="hop-db-backup"
SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Creating GCS bucket: gs://$BUCKET"
gcloud storage buckets create "gs://${BUCKET}" \
  --project="$PROJECT" \
  --location="$REGION" \
  --uniform-bucket-level-access

echo "==> Setting 7-day lifecycle rule"
LIFECYCLE_FILE="$(mktemp /tmp/lifecycle.XXXXXX.json)"
cat > "$LIFECYCLE_FILE" <<'EOF'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 7}
    }
  ]
}
EOF
gcloud storage buckets update "gs://${BUCKET}" --lifecycle-file="$LIFECYCLE_FILE"
rm -f "$LIFECYCLE_FILE"

echo "==> Creating service account: $SA_EMAIL"
gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT" \
  --display-name="hop-db daily backup"

echo "==> Waiting for SA propagation..."
sleep 15

echo "==> Granting bucket write access to SA"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role=roles/storage.objectUser

echo "==> Stopping VM to attach service account (will restart automatically)"
gcloud compute instances stop "$VM_NAME" --zone="$ZONE" --project="$PROJECT"

gcloud compute instances set-service-account "$VM_NAME" \
  --zone="$ZONE" \
  --project="$PROJECT" \
  --service-account="$SA_EMAIL" \
  --scopes=https://www.googleapis.com/auth/devstorage.read_write

gcloud compute instances start "$VM_NAME" --zone="$ZONE" --project="$PROJECT"
echo "==> VM restarted with backup service account."

echo "==> Waiting 20s for VM to be ready..."
sleep 20

echo "==> Deploying backup.sh to VM"
gcloud compute scp "${SCRIPT_DIR}/backup.sh" "${VM_NAME}:/tmp/pg-backup.sh" --zone="$ZONE"

echo "==> Installing backup script and cron on VM"
gcloud compute ssh "$VM_NAME" --zone="$ZONE" -- bash -s <<'REMOTE'
sudo mv /tmp/pg-backup.sh /usr/local/bin/pg-backup.sh
sudo chmod +x /usr/local/bin/pg-backup.sh
sudo chown postgres:postgres /usr/local/bin/pg-backup.sh

(sudo -u postgres crontab -l 2>/dev/null || true; \
 echo "0 3 * * * /usr/local/bin/pg-backup.sh >> /var/log/pg-backup.log 2>&1") \
 | sudo -u postgres crontab -

echo "Cron installed:"
sudo -u postgres crontab -l
REMOTE

echo ""
echo "==> Backup setup complete."
echo "Test manually on VM: sudo -u postgres /usr/local/bin/pg-backup.sh"
echo "Check bucket: gcloud storage ls gs://${BUCKET}/"
