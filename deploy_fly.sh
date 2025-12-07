#!/bin/bash
# Quick deploy script for Fly.io
# Usage: bash deploy_fly.sh

# Add Fly CLI to PATH
export PATH="$PATH:/c/Users/DK/.fly/bin"

# Check if flyctl is available
if ! command -v flyctl.exe &> /dev/null && [ ! -f "/c/Users/DK/.fly/bin/flyctl.exe" ]; then
    echo "❌ Fly CLI not found. Installing..."
    powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
    export PATH="$PATH:/c/Users/DK/.fly/bin"
fi

# Use full path if alias doesn't work
FLY_CMD="/c/Users/DK/.fly/bin/flyctl.exe"

echo "🚀 Starting Fly.io deployment..."
echo ""

# Check if logged in
$FLY_CMD auth whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "📝 Please login to Fly.io..."
    $FLY_CMD auth login
fi

# Launch app (if not already launched)
if [ ! -f "fly.toml" ] || ! $FLY_CMD status &> /dev/null; then
    echo "🚀 Launching app..."
    $FLY_CMD launch --no-deploy
fi

# Set required secrets
echo "🔐 Setting environment variables..."
$FLY_CMD secrets set PORT=8000 BACKEND_HOST=0.0.0.0 BACKEND_PORT=8000 DEBUG_MODE=false

# Deploy
echo "🚀 Deploying..."
$FLY_CMD deploy

echo ""
echo "✅ Deployment complete!"
echo "📊 Check status: $FLY_CMD status"
echo "📋 View logs: $FLY_CMD logs"

