#!/bin/bash
# ──────────────────────────────────────────────
# ProfileVault aaPanel One-Click Deployment Script
# ──────────────────────────────────────────────

echo "================================================="
echo "🚀 Starting ProfileVault Deployment on aaPanel..."
echo "================================================="

# 1. Install NPM Dependencies
echo "📦 Installing production dependencies..."
npm install --production=false

# 2. Build Renderer and Main Server Bundles
echo "🛠️ Building web application and backend bundles..."
npm run build

# 3. Create Server Storage & Set Secure Permissions
echo "🔒 Configuring storage permissions..."
mkdir -p aaPanel-deployment
chmod 755 aaPanel-deployment
chmod 600 aaPanel-deployment/.env.production 2>/dev/null || true

# 4. Check PM2 Installation
if command -v pm2 >/dev/null 2>&1; then
    echo "⚡ Restarting PM2 process..."
    pm2 reload aaPanel-deployment/ecosystem.config.js || pm2 start aaPanel-deployment/ecosystem.config.js
    pm2 save
else
    echo "💡 PM2 is not globally installed. Starting with Node.js directly..."
    node aaPanel-deployment/server.js &
fi

echo "================================================="
echo "✅ ProfileVault Production Deployment Ready!"
echo "   Server URL: http://127.0.0.1:3000"
echo "   Admin Panel: http://127.0.0.1:3000/#admin"
echo "================================================="
