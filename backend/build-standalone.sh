#!/bin/bash

echo "Building standalone Python backend..."

# Активируем venv
source venv/bin/activate

# Устанавливаем PyInstaller если нет
pip install pyinstaller

# Создаём standalone executable
pyinstaller --onedir \
  --name markdown-pdf-backend \
  --add-data "src:src" \
  --hidden-import uvicorn \
  --hidden-import fastapi \
  --hidden-import weasyprint \
  --hidden-import markdown \
  --hidden-import pygments \
  --collect-all pygments \
  --collect-all weasyprint \
  --collect-all tinycss2 \
  --collect-all cffi \
  --clean \
  app.py

echo "✓ Standalone backend created in dist/markdown-pdf-backend"

deactivate
