#!/bin/bash

# Three-Agent Browser Automation Test Script
# This script demonstrates how to use the three-agent system

set -e

BASE_URL="http://localhost:3000"
API_ENDPOINT="$BASE_URL/automation/three-agent-run"

echo "🤖 Three-Agent Browser Automation Test"
echo "======================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Simple Google Search
echo -e "${BLUE}Test 1: Google Search${NC}"
echo "Starting automation job..."

RESPONSE=$(curl -s -X POST "$API_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Search for artificial intelligence news on Google",
    "start_url": "https://www.google.com",
    "headless": true,
    "max_steps": 10
  }')

JOB_ID=$(echo "$RESPONSE" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$JOB_ID" ]; then
  echo "❌ Failed to start job"
  echo "$RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Job started with ID: $JOB_ID${NC}"
echo ""

# Monitor job status
echo -e "${YELLOW}Monitoring job progress...${NC}"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Stream events using curl
curl -N -s "$BASE_URL/automation/stream/$JOB_ID" | while read -r line; do
  # Parse SSE format
  if [[ $line == data:* ]]; then
    data="${line#data:}"
    event_type=$(echo "$data" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)
    
    case "$event_type" in
      "agent_thinking")
        agent=$(echo "$data" | grep -o '"agent":"[^"]*"' | cut -d'"' -f4)
        message=$(echo "$data" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        echo -e "${BLUE}🧠 $agent: $message${NC}"
        ;;
      "plan_created")
        echo -e "${GREEN}📋 Plan Created${NC}"
        ;;
      "plan_updated")
        echo -e "${YELLOW}📋 Plan Updated (replanning)${NC}"
        ;;
      "step")
        message=$(echo "$data" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        echo -e "   ⚙️  $message"
        ;;
      "action_executed")
        action=$(echo "$data" | grep -o '"action":"[^"]*"' | cut -d'"' -f4)
        echo -e "${GREEN}   ✓ Action: $action${NC}"
        ;;
      "critique_result")
        status=$(echo "$data" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        echo -e "   🔍 Critique: $status"
        ;;
      "job_finished")
        echo -e "${GREEN}✅ Job completed successfully!${NC}"
        break
        ;;
      "job_failed")
        error=$(echo "$data" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo -e "❌ Job failed: $error"
        break
        ;;
    esac
  fi
done

echo ""
echo -e "${GREEN}Test completed!${NC}"
echo ""

# Get final status
echo -e "${BLUE}Final job status:${NC}"
curl -s "$BASE_URL/automation/status/$JOB_ID" | jq '.'

echo ""
echo "======================================="
echo "More test examples:"
echo ""
echo "# Test 2: Extract data from Hacker News"
echo "curl -X POST $API_ENDPOINT \\"
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{
    "prompt": "Extract the titles of the top 5 posts from Hacker News",
    "start_url": "https://news.ycombinator.com",
    "headless": true
  }'"'"
echo ""
echo "# Test 3: Wikipedia search"
echo "curl -X POST $API_ENDPOINT \\"
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{
    "prompt": "Search for TypeScript on Wikipedia and get the first paragraph",
    "start_url": "https://www.wikipedia.org",
    "headless": true
  }'"'"
echo ""
echo "# Test 4: Weather lookup"
echo "curl -X POST $API_ENDPOINT \\"
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{
    "prompt": "Search for weather in New York",
    "start_url": "https://www.google.com",
    "headless": true
  }'"'"

