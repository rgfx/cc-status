#!/bin/bash
# Test script to see if Claude Code is calling the statusline
echo "$(date): Called with input" >> /tmp/cc-status-debug.log
cat >> /tmp/cc-status-debug.log
echo "TEST STATUSLINE OUTPUT"
