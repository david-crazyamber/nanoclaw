#!/bin/bash
#
# Test MiniMax API Connection
#

# Load environment from .env
set -a
source .env 2>/dev/null || true
set +a

echo "=== Testing MiniMax API ==="
echo ""
echo "Configuration:"
echo "  Base URL: $ANTHROPIC_BASE_URL"
echo "  Model: $ANTHROPIC_MODEL"
echo "  Token length: ${#ANTHROPIC_AUTH_TOKEN} chars"
echo ""

# Validate required environment variables
if [ -z "$ANTHROPIC_BASE_URL" ]; then
  echo "ERROR: ANTHROPIC_BASE_URL is not set"
  exit 1
fi

if [ -z "$ANTHROPIC_MODEL" ]; then
  echo "ERROR: ANTHROPIC_MODEL is not set"
  exit 1
fi

if [ -z "$ANTHROPIC_AUTH_TOKEN" ]; then
  echo "ERROR: ANTHROPIC_AUTH_TOKEN is not set"
  exit 1
fi

# Test connectivity to the base URL first
echo "Step 1: Testing connectivity to base URL..."
if ! curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$ANTHROPIC_BASE_URL" > /dev/null 2>&1; then
  echo "ERROR: Cannot connect to $ANTHROPIC_BASE_URL"
  echo "Check your network connection and ANTHROPIC_BASE_URL configuration"
  exit 1
fi
echo "  Connectivity: OK"
echo ""

# Test with curl
echo "Step 2: Sending test API request..."
echo "  Endpoint: ${ANTHROPIC_BASE_URL}/v1/messages"
echo "  Model: $ANTHROPIC_MODEL"
echo ""

RESPONSE=$(curl -s -w "\n___HTTP_CODE___:%{http_code}" -X POST \
  "${ANTHROPIC_BASE_URL}/v1/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${ANTHROPIC_AUTH_TOKEN}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "'"${ANTHROPIC_MODEL}"'",
    "max_tokens": 100,
    "messages": [
      {"role": "user", "content": "Say hello in one word"}
    ]
  }')

# Extract HTTP code and body
HTTP_CODE=$(echo "$RESPONSE" | grep "___HTTP_CODE___:" | cut -d':' -f2)
BODY=$(echo "$RESPONSE" | sed 's/___HTTP_CODE___:.*//')

echo "Response:"
echo "$BODY" | jq .
echo ""

# Parse response
if [ "$HTTP_CODE" = "200" ]; then
  echo "=== Test Complete: SUCCESS (HTTP $HTTP_CODE) ==="
  exit 0
else
  echo "=== Test Complete: FAILED (HTTP $HTTP_CODE) ==="
  echo ""
  echo "Troubleshooting tips:"
  echo "  1. Verify ANTHROPIC_AUTH_TOKEN is correct in .env"
  echo "  2. Check ANTHROPIC_BASE_URL points to a valid API endpoint"
  echo "  3. Ensure ANTHROPIC_MODEL is a valid model name"
  echo "  4. Check network/firewall settings"
  exit 1
fi
