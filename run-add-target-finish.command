#!/bin/bash
cd "$(dirname "$0")"
node scripts/add-target-finish.mjs
echo
read -p "Press Enter to close."
