#!/bin/bash
# Manual deploy script — run this when you want to push live
set -e

export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"

echo "🚀 Deploying API..."
cd "$(dirname "$0")/../apps/api"
vercel --prod --yes

echo "🚀 Deploying Web..."
cd "$(dirname "$0")/../apps/web"
vercel --prod --yes

echo "✅ Both deployed!"
