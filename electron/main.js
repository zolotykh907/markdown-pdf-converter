const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

let mainWindow;
let printWindow;
const isDev = process.env.NODE_ENV === 'development';

const FONT_FAMILIES = {
  Inter: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  Arial: 'Arial, sans-serif',
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': 'Times, "Times New Roman", serif',
  Courier: 'Courier, "Courier New", monospace',
  Georgia: 'Georgia, "Times New Roman", serif',
  Verdana: 'Verdana, Arial, sans-serif',
};

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

function safeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback;
}

function createPrintDocument(contentHtml, settings = {}) {
  const fontFamily = FONT_FAMILIES[settings.font_family] || FONT_FAMILIES.Inter;
  const fontSize = clampNumber(settings.font_size, 12, 8, 24);
  const lineHeight = clampNumber(settings.line_height, 1.6, 1, 3);
  const marginTop = clampNumber(settings.margin_top, 72, 0, 200);
  const marginRight = clampNumber(settings.margin_right, 72, 0, 200);
  const marginBottom = clampNumber(settings.margin_bottom, 72, 0, 200);
  const marginLeft = clampNumber(settings.margin_left, 72, 0, 200);
  const textColor = safeColor(settings.text_color, '#000000');
  const backgroundColor = safeColor(settings.background_color, '#ffffff');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: ${marginTop}pt ${marginRight}pt ${marginBottom}pt ${marginLeft}pt;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      color: ${textColor};
      background: ${backgroundColor};
      font-family: ${fontFamily};
      font-size: ${fontSize}pt;
      line-height: ${lineHeight};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    h1, h2, h3, h4, h5, h6 {
      color: ${textColor};
      font-weight: 700;
      break-after: avoid;
    }

    h1 { font-size: ${fontSize * 2}pt; margin: 18pt 0 12pt; }
    h2 { font-size: ${fontSize * 1.5}pt; margin: 14pt 0 10pt; }
    h3, h4, h5, h6 { font-size: ${fontSize * 1.25}pt; margin: 12pt 0 8pt; }
    p { margin: 0 0 12pt; text-align: justify; }
    ul, ol { margin: 0 0 12pt; padding-left: 20pt; }
    li { margin: 0 0 6pt; }
    a { color: #2563eb; text-decoration: underline; }
    img { display: block; max-width: 100%; height: auto; margin: 12pt auto; break-inside: avoid; }

    code {
      border-radius: 3pt;
      background: #f3f4f6;
      padding: 2pt 4pt;
      font-family: "Courier New", Courier, monospace;
    }

    pre {
      overflow-wrap: anywhere;
      white-space: pre-wrap;
      margin: 12pt 0;
      border-radius: 6pt;
      background: #f3f4f6;
      padding: 12pt;
      break-inside: avoid;
    }

    pre code { background: transparent; padding: 0; }
    mark { border-radius: 2pt; background: #fff176; color: inherit; padding: 0 2pt; }

    blockquote {
      margin: 12pt 0;
      border-left: 4pt solid #d1d5db;
      padding-left: 20pt;
      font-style: italic;
    }

    table { width: 100%; margin: 12pt 0; border-collapse: collapse; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th, td { border: 1pt solid #d1d5db; padding: 8pt; text-align: left; }
    th { background: #f3f4f6; font-weight: 700; }
    hr { margin: 18pt 0; border: 0; border-top: 1pt solid #d1d5db; }
    input[type="checkbox"] { margin-right: 6pt; }
  </style>
</head>
<body>${contentHtml}</body>
</html>`;
}

function getPrintWindow() {
  if (printWindow && !printWindow.isDestroyed()) return printWindow;

  printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  printWindow.on('closed', () => {
    printWindow = null;
  });

  return printWindow;
}

async function renderPdf(contentHtml, settings) {
  const documentHtml = createPrintDocument(contentHtml, settings);
  const documentUrl = `data:text/html;charset=utf-8;base64,${Buffer.from(documentHtml).toString('base64')}`;
  const targetWindow = getPrintWindow();

  await targetWindow.loadURL(documentUrl);
  await targetWindow.webContents.executeJavaScript(`
    Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...Array.from(document.images).map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          }))
    ]).then(() => true)
  `);

  return targetWindow.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
}

function sanitizePdfName(value) {
  const baseName = String(value || 'document.pdf')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim();
  return baseName.toLowerCase().endsWith('.pdf') ? baseName : `${baseName}.pdf`;
}

ipcMain.handle('pdf:export', async (event, payload = {}) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('PDF export is only available from the main application window');
  }

  if (typeof payload.html !== 'string' || !payload.html.trim()) {
    throw new Error('Document is empty');
  }

  const fileName = sanitizePdfName(payload.fileName);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Сохранить PDF',
    defaultPath: path.join(app.getPath('documents'), fileName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePath) return { canceled: true };

  const pdfBuffer = await renderPdf(payload.html, payload.settings);
  await fs.promises.writeFile(result.filePath, pdfBuffer);
  return { canceled: false, filePath: result.filePath };
});

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
      webSecurity: isDev,
    },
    icon: path.join(__dirname, '..', 'frontend', 'public', 'favicon.png'),
    title: 'Markdown to PDF Converter',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'frontend', 'dist', 'index.html')
      : path.join(__dirname, '..', 'frontend', 'dist', 'index.html');

    if (!fs.existsSync(indexPath)) {
      console.error('Frontend build not found:', indexPath);
    }

    mainWindow.loadURL(url.pathToFileURL(indexPath).href).catch((error) => {
      console.error('Error loading frontend:', error);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
