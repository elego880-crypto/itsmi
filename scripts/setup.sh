#!/bin/bash
# ITSMI - server initial setup (Ubuntu 24.04)
# Usage: bash scripts/setup.sh

set -e

echo "Installing dependencies..."
apt-get update -qq
apt-get install -y nodejs npm postgresql caddy

echo "Creating database..."
sudo -u postgres psql <<SQL
  CREATE USER itsmi WITH PASSWORD 'itsmi_pass_2026';
  CREATE DATABASE itsmi_db OWNER itsmi;
  GRANT ALL PRIVILEGES ON DATABASE itsmi_db TO itsmi;
SQL

echo "Installing PM2..."
npm install -g pm2

echo "Cloning repository..."
mkdir -p /var/www
cd /var/www
git clone https://github.com/elego880-crypto/itsmi.git
cd itsmi
npm install --production

echo "Starting application..."
pm2 start server/index.js --name itsmi
pm2 save
pm2 startup

echo "Setup complete"
