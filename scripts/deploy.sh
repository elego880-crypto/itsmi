#!/bin/bash
# ITSMI - production deploy script
# Usage: bash scripts/deploy.sh

set -e

SERVER="root@82.148.239.207"
APP_DIR="/var/www/itsmi"
APP_NAME="itsmi"

echo "Deploying ITSMI..."

ssh $SERVER << EOF
  cd $APP_DIR
  git pull origin main
  npm install --production
  pm2 restart $APP_NAME
  echo "Done"
EOF

echo "Deploy complete"
