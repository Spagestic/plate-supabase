#!/bin/bash

# Simple test script to open multiple browser windows to test collaboration
echo "Testing collaborative Slate editor..."
echo "This will open multiple browser windows to test real-time collaboration"

# Open multiple browser windows (adjust URLs based on your local setup)
echo "Opening first browser window..."
start "http://localhost:3000/slate" 2>/dev/null || open "http://localhost:3000/slate" 2>/dev/null || xdg-open "http://localhost:3000/slate" 2>/dev/null

sleep 2

echo "Opening second browser window..."
start "http://localhost:3000/slate" 2>/dev/null || open "http://localhost:3000/slate" 2>/dev/null || xdg-open "http://localhost:3000/slate" 2>/dev/null

echo "Both windows should now be open. Test by:"
echo "1. Type in one window and see if it appears in the other"
echo "2. Check the browser console for debug messages"
echo "3. Look for active users in the top-right corner"
