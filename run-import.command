#!/bin/bash
cd "$(dirname "$0")"
echo "Importing 3.5次元 articles into Reading Record…"
node scripts/import-wordpress-articles.mjs imports/3.5-all-articles.md --source "3.5次元"
echo
echo "You can close this window."
