#!/bin/bash

# Test script for deployment verification
echo "🚀 Testing Six Loan Backend..."
echo ""

# Check if dist exists
if [ ! -d "dist" ]; then
  echo "❌ dist folder not found. Running build..."
  npm run build
fi

# Start server in background
echo "Starting server on port 4002..."
PORT=4002 node dist/index.js &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Test root endpoint
echo ""
echo "Testing root endpoint (/)..."
RESPONSE=$(curl -s http://localhost:4002/)
echo "Response: $RESPONSE"

# Test health endpoint
echo ""
echo "Testing health endpoint (/health)..."
HEALTH=$(curl -s http://localhost:4002/health)
echo "Response: $HEALTH"

# Cleanup
kill $SERVER_PID 2>/dev/null

echo ""
echo "✅ Test complete!"
