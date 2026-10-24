#!/bin/bash
# Double-click to run the site locally at http://localhost:5173 (reads .env.local).
cd "$(dirname "$0")"
npm run dev -- --port 5173
