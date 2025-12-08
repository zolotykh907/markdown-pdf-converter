#!/bin/bash

# Скрипт для запуска Markdown to PDF Converter

echo "🚀 Запуск Markdown to PDF Converter..."

# Проверка наличия Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 не найден. Установите Python 3 и попробуйте снова."
    exit 1
fi

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не найден. Установите Node.js и попробуйте снова."
    exit 1
fi

# Запуск backend
echo "📦 Запуск backend сервера..."
cd backend

# Создание виртуального окружения, если его нет
if [ ! -d "venv" ]; then
    echo "🔧 Создание виртуального окружения..."
    python3 -m venv venv
fi

# Активация виртуального окружения
source venv/bin/activate

# Установка зависимостей, если requirements.txt изменился
pip install -q -r requirements.txt

# Запуск backend в фоновом режиме
python app.py &
BACKEND_PID=$!
echo "✅ Backend запущен (PID: $BACKEND_PID) на http://localhost:8000"

cd ..

# Запуск frontend
echo "📦 Запуск frontend сервера..."
cd frontend

# Установка зависимостей, если node_modules нет
if [ ! -d "node_modules" ]; then
    echo "🔧 Установка зависимостей frontend..."
    npm install
fi

# Запуск frontend
echo "✅ Frontend запускается на http://localhost:5173"
npm run dev

# При завершении работы frontend, остановить backend
echo ""
echo "🛑 Остановка серверов..."
kill $BACKEND_PID 2>/dev/null
deactivate 2>/dev/null

echo "✅ Приложение остановлено"
