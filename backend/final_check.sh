#!/bin/bash

# Final system check script
echo "Final System Check - Analysis Workflow Template"
echo "=================================================="

# Check if server is running
echo "1. Checking server status..."
if curl -s http://localhost:3002/api/health > /dev/null; then
    echo "Server is running and healthy"
else
    echo "Server is not responding"
    exit 1
fi

# Test applications endpoint
echo "2. Testing applications endpoint..."
APPS_RESPONSE=$(curl -s http://localhost:3002/api/applications)
if echo "$APPS_RESPONSE" | grep -q '\['; then
    echo "Applications endpoint working"
else
    echo "Applications endpoint failed"
    exit 1
fi

# Test stats endpoint
echo "3. Testing stats endpoint..."
STATS_RESPONSE=$(curl -s http://localhost:3002/api/stats)
if echo "$STATS_RESPONSE" | grep -q '"uptime"'; then
    echo "Stats endpoint working"
else
    echo "Stats endpoint failed"
fi

# Check memory usage
echo "4. Checking system resources..."
MEMORY_INFO=$(curl -s http://localhost:3002/api/health | grep -o '"memory":[^}]*}')
if [ ! -z "$MEMORY_INFO" ]; then
    echo "Memory monitoring active"
    echo "   $MEMORY_INFO"
else
    echo "Memory monitoring not working"
fi

# Check database connectivity
echo "5. Testing database connectivity..."
DB_CHECK=$(curl -s http://localhost:3002/api/health | grep -o '"database":"[^"]*"')
if echo "$DB_CHECK" | grep -q 'connected'; then
    echo "Database connected"
else
    echo "Database connection issue"
fi

echo ""
echo "System check completed"
