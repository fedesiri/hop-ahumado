#!/usr/bin/env bash
# Install and configure Postgres 16 on the hop-db VM.
# Run on the VM via:
#   gcloud compute ssh hop-db --zone=us-central1-a -- 'bash -s' < scripts/infra/02-postgres-setup.sh
#
# After the script finishes, manually create the DB user and database:
#   sudo -u postgres psql -c "CREATE USER hop_user WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';"
#   sudo -u postgres psql -c "CREATE DATABASE hop_ahumado OWNER hop_user;"
#
# Generate a strong password with: openssl rand -base64 32

set -euo pipefail

PG_VERSION="16"
PG_CONF="/etc/postgresql/${PG_VERSION}/main/postgresql.conf"
PG_HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"

echo "==> Installing Postgres $PG_VERSION from postgresql.org"
sudo apt-get install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list
sudo apt-get update -q
sudo apt-get install -y "postgresql-${PG_VERSION}"

echo "==> Tuning postgresql.conf for e2-micro (1 GB RAM)"
sudo sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" "$PG_CONF"
sudo sed -i "s/^#\?shared_buffers\s*=.*/shared_buffers = 128MB/" "$PG_CONF"
sudo sed -i "s/^#\?max_connections\s*=.*/max_connections = 20/" "$PG_CONF"
sudo sed -i "s/^#\?work_mem\s*=.*/work_mem = 4MB/" "$PG_CONF"
sudo sed -i "s/^#\?ssl\s*=.*/ssl = on/" "$PG_CONF"

echo "==> Configuring pg_hba.conf (hostssl + scram-sha-256 for all remote)"
sudo tee "$PG_HBA" > /dev/null <<'EOF'
# Local connections use peer auth (for cron backups, psql as postgres)
local   all             postgres                                peer
local   all             all                                     peer
# Loopback
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
# Remote: require SSL + scram-sha-256 (Cloud Run → VM)
hostssl all             all             0.0.0.0/0               scram-sha-256
EOF

echo "==> Enabling systemd auto-restart"
sudo mkdir -p /etc/systemd/system/postgresql@.service.d
sudo tee /etc/systemd/system/postgresql@.service.d/restart.conf > /dev/null <<'EOF'
[Service]
Restart=on-failure
RestartSec=10s
EOF
sudo systemctl daemon-reload

echo "==> Restarting Postgres"
sudo systemctl restart "postgresql@${PG_VERSION}-main"
sudo systemctl enable "postgresql@${PG_VERSION}-main"

echo ""
echo "==> Postgres $PG_VERSION is running."
echo ""
echo "Next steps (run manually on this VM):"
echo "  sudo -u postgres psql -c \"CREATE USER hop_user WITH PASSWORD 'STRONG_PASSWORD';\""
echo "  sudo -u postgres psql -c \"CREATE DATABASE hop_ahumado OWNER hop_user;\""
echo ""
echo "Test remote connection from your local machine:"
echo "  psql 'postgresql://hop_user:PASSWORD@VM_IP:5432/hop_ahumado?sslmode=require' -c '\\conninfo'"
