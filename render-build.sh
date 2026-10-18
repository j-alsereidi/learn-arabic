#!/usr/bin/env bash
set -euo pipefail

python -m pip install -r requirements.txt

cd frontend

export REACT_APP_API_URL=""

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build