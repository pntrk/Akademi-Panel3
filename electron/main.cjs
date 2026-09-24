const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
app.userAgentFallback = CHROME_USER_AGENT;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function startLocalServer(distDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqUrl = req.url.split('?')[0];
      let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);

      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading file');
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(content);
        }
      });
    });

    server.listen(3000, '127.0.0.1', () => {
      resolve(3000);
    }).on('error', () => {
      server.listen(0, '127.0.0.1', () => {
        resolve(server.address().port);
      });
    });
  });
}

async function createWindow() {
  if (session.defaultSession) {
    session.defaultSession.setUserAgent(CHROME_USER_AGENT);
  }

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Akademi Panel',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Enable popups for Google OAuth
  mainWindow.webContents.setWindowOpenHandler((details) => {
    return {
      action: 'allow'
    };
  });

  // Ensure popup windows use Chrome User-Agent
  mainWindow.webContents.on('did-create-window', (childWindow) => {
    childWindow.webContents.setUserAgent(CHROME_USER_AGENT);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    const distDir = path.join(__dirname, '../dist');
    const port = await startLocalServer(distDir);
    mainWindow.loadURL(`http://localhost:${port}`);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

