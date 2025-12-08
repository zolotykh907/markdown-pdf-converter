#!/bin/bash

# Скрипт первоначальной настройки Markdown to PDF Converter

echo "⚙️  Настройка Markdown to PDF Converter..."

# Проверка наличия Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден. Установите Python 3:"
    echo "   brew install python3  (на macOS)"
    exit 1
fi

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js:"
    echo "   brew install node  (на macOS)"
    exit 1
fi

echo "✅ Python и Node.js установлены"

# Настройка backend
echo ""
echo "📦 Настройка backend..."
cd backend

echo "🔧 Создание виртуального окружения..."
python3 -m venv venv

echo "🔧 Активация виртуального окружения..."
source venv/bin/activate

echo "🔧 Установка зависимостей Python..."
pip install -r requirements.txt

echo "✅ Backend настроен"

cd ..

# Настройка frontend
echo ""
echo "📦 Настройка frontend..."
cd frontend

echo "🔧 Установка зависимостей Node.js..."
npm install

echo "✅ Frontend настроен"

cd ..

# Делаем start.sh исполняемым
chmod +x start.sh

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "Для запуска приложения используйте:"
echo "  ./start.sh"
echo ""
echo "Или запускайте вручную:"
echo "  1. Backend:  cd backend && source venv/bin/activate && python app.py"
echo "  2. Frontend: cd frontend && npm run dev"
