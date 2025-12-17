FROM node:18-alpine

WORKDIR /app

# Копирование package.json и package-lock.json
COPY package.json package-lock.json ./

# Установка зависимостей
RUN npm ci --legacy-peer-deps

# Копирование остальных файлов
COPY . .

# Открытие порта
EXPOSE 5173

# Запуск dev сервера
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
