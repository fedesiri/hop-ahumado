#!/usr/bin/env bash
# Provision the hop-db e2-micro VM (GCP always-free tier).
# Run once from your local machine after: gcloud auth login
#
# After running, note the printed static IP — you'll need it for DATABASE_URL.

set -euo pipefail

PROJECT="hop-ahumado-prod-492215"
ZONE="us-central1-a"
REGION="us-central1"
VM_NAME="hop-db"
IP_NAME="hop-db-ip"
FIREWALL_RULE="allow-postgres"
MACHINE_TYPE="e2-micro"
DISK_SIZE="30GB"
DISK_TYPE="pd-standard"
IMAGE_FAMILY="debian-12"
IMAGE_PROJECT="debian-cloud"

echo "==> Reserving static external IP: $IP_NAME"
gcloud compute addresses create "$IP_NAME" \
  --region="$REGION" \
  --project="$PROJECT"

echo "==> Creating VM: $VM_NAME"
gcloud compute instances create "$VM_NAME" \
  --project="$PROJECT" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --image-family="$IMAGE_FAMILY" \
  --image-project="$IMAGE_PROJECT" \
  --boot-disk-size="$DISK_SIZE" \
  --boot-disk-type="$DISK_TYPE" \
  --address="$IP_NAME" \
  --tags=postgres-server \
  --metadata=enable-oslogin=TRUE

echo "==> Creating firewall rule: $FIREWALL_RULE"
gcloud compute firewall-rules create "$FIREWALL_RULE" \
  --project="$PROJECT" \
  --allow=tcp:5432 \
  --target-tags=postgres-server \
  --source-ranges=0.0.0.0/0 \
  --description="Postgres: auth enforced via pg_hba.conf (hostssl + scram-sha-256)"

echo ""
echo "==> Static IP address:"
gcloud compute addresses describe "$IP_NAME" \
  --region="$REGION" \
  --project="$PROJECT" \
  --format="value(address)"

echo ""
echo "Next: run 02-postgres-setup.sh on the VM."
echo "SSH: gcloud compute ssh $VM_NAME --zone=$ZONE"
