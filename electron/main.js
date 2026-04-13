const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const url = require('url');

let mainWindow;
let backendProcess;
const isDev = process.env.NODE_ENV === 'development';

// Путь к Python в зависимости от платформы
function getPythonPath() {
  if (app.isPackaged) {
    // В упакованном приложении
    if (process.platform === 'win32') {
      return path.join(process.resourcesPath, 'backend', 'venv', 'Scripts', 'python.exe');
    } else {
      return path.join(process.resourcesPath, 'backend', 'venv', 'bin', 'python');
    }
  } else {
    // В режиме разработки
    if (process.platform === 'win32') {
      return path.join(__dirname, '..', 'backend', 'venv', 'Scripts', 'python.exe');
    } else {
      return path.join(__dirname, '..', 'backend', 'venv', 'bin', 'python');
    }
  }
}

// Путь к app.py
function getBackendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', 'app.py');
  } else {
    return path.join(__dirname, '..', 'backend', 'app.py');
  }
}

// Получить путь к standalone backend executable (если существует)
function getStandaloneBackendPath() {
  const execName = process.platform === 'win32' ? 'markdown-pdf-backend.exe' : 'markdown-pdf-backend';
  const baseDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');

  // Prefer onedir bundle for faster startup
  const onedirPath = path.join(baseDir, 'backend', 'dist', 'markdown-pdf-backend', execName);
  if (fs.existsSync(onedirPath)) return onedirPath;

  // Fallback to onefile bundle
  return path.join(baseDir, 'backend', 'dist', execName);
}

// Проверка доступности backend (быстрая версия)
async function waitForBackend(maxAttempts = 20) {
  const http = require('http');

  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:8000/', (res) => {
          resolve(true);
        });
        req.on('error', reject);
        req.setTimeout(500);
      });
      console.log('Backend is ready!');
      return true;
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  console.error('Backend failed to start after timeout');
  return false;
}

// Запуск Python backend
function startBackend() {
  return new Promise((resolve, reject) => {
    const backendPath = getBackendPath();
    const standalonePath = getStandaloneBackendPath();

    let command;
    let args = [];
    let useStandalone = false;

    console.log('=================================');
    console.log('Starting backend...');
    console.log('Is packaged:', app.isPackaged);
    console.log('Platform:', process.platform);
    console.log('Backend path:', backendPath);
    console.log('Standalone path:', standalonePath);
    console.log('Resources path:', app.isPackaged ? process.resourcesPath : 'N/A');
    console.log('=================================');

    // Проверяем standalone executable
    if (fs.existsSync(standalonePath)) {
      console.log('✓ Found standalone backend executable');
      command = standalonePath;
      useStandalone = true;
    } else {
      console.log('Standalone backend not found, using Python...');

      // Проверяем существование backend файла
      if (!fs.existsSync(backendPath)) {
        console.error('ERROR: Backend app.py not found at:', backendPath);
        reject(new Error('Backend not found'));
        return;
      }

      const pythonPath = getPythonPath();
      if (!fs.existsSync(pythonPath)) {
        console.error('ERROR: Python interpreter not found at:', pythonPath);
        reject(new Error('Python interpreter not found'));
        return;
      }

      command = pythonPath;
      args = ['-u', backendPath]; // -u для unbuffered output
    }

    const cwd = app.isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, '..', 'backend');

    console.log('Executing:', command, args.join(' '));
    console.log('Working directory:', cwd);
    console.log('Directory exists:', fs.existsSync(cwd));

    backendProcess = spawn(command, args, {
      cwd: cwd,
      env: { ...process.env }
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend] ${data.toString().trim()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      reject(err);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });

    // Не ждём - сразу возвращаем
    resolve();
  });
}

// Остановка backend при закрытии приложения
function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend...');
    backendProcess.kill();
    backendProcess = null;
  }
}

// Создание главного окна
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // В production режиме нужно разрешить загрузку локальных файлов
      webSecurity: isDev ? true : false,
    },
    icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.png'),
    title: 'Markdown to PDF Converter',
    show: false, // Не показываем окно до загрузки
  });

  // Показываем окно когда готово
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools только в dev режиме
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Логируем ошибки загрузки
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Загружаем frontend
  if (isDev) {
    // В режиме разработки - из Vite dev server
    console.log('Loading from Vite dev server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
  } else {
    // В продакшене - из собранных файлов
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend', 'dist', 'index.html')
      : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

    console.log('Loading from file:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    console.log('Absolute path:', path.resolve(indexPath));

    if (!fs.existsSync(indexPath)) {
      console.error('ERROR: index.html not found at:', indexPath);
      console.error('Resources path:', process.resourcesPath);
      console.error('__dirname:', __dirname);

      // Показываем список файлов для отладки
      const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'frontend', 'dist');
      console.error('Contents of resources dir:');
      if (fs.existsSync(resourcesDir)) {
        console.error(fs.readdirSync(resourcesDir));
      }
    }

    // Используем file:// URL для загрузки
    const fileUrl = url.pathToFileURL(indexPath).href;
    console.log('Loading URL:', fileUrl);

    mainWindow.loadURL(fileUrl).catch(err => {
      console.error('Error loading file:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Запуск приложения
app.whenReady().then(async () => {
  console.log('App is ready, starting...');

  // Сразу создаём окно (UI появится быстро)
  createWindow();

  // Параллельно запускаем backend
  try {
    startBackend();
    console.log('Backend starting in background...');

    // Ждём backend в фоне (не блокируем UI)
    waitForBackend().then(isReady => {
      if (!isReady) {
        console.error('WARNING: Backend might not be running properly');
      } else {
        console.log('Backend is fully ready');
      }
    });
  } catch (err) {
    console.error('Failed to start backend:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Закрытие приложения
app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackend();
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  stopBackend();
});
