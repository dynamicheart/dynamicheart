#!/bin/bash
set -e

cd "$(dirname "$0")"

cd web && BASE_PATH=/dynamicheart/tools/pdf_watermark/ npm run build && cd ..

rm -rf _site
mkdir -p _site/tools/pdf_watermark
cp index.html _site/
cp -r web/dist/* _site/tools/pdf_watermark/
cp -r tools/model-profiling _site/tools/model-profiling

echo "Serving at http://localhost:8000"
python3 -m http.server 8000 -d _site
