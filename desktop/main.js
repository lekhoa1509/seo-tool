const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const PORT = 4573;

let backendProcess = null;
let mainWindow = null;

function backendEntryPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'server.js')
    : path.join(__dirname, '..', 'backend', 'server.js');
}

function frontendDistPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'frontend-dist')
    : path.join(__dirname, '..', 'frontend', 'dist');
}

function startBackend() {
  // Run the bundled Node/Express backend using Electron's own binary in
  // "run as Node" mode, so we don't depend on a system Node.js install.
  backendProcess = spawn(process.execPath, [backendEntryPath()], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      NODE_ENV: 'production',
      SEO_TOOL_DESKTOP: '1',
      SEO_TOOL_CONFIG_DIR: app.getPath('userData'),
      SERVE_FRONTEND_DIR: frontendDistPath(),
      FRONTEND_URL: `http://localhost:${PORT}`,
      GOOGLE_REDIRECT_URI: `http://localhost:${PORT}/api/gsc/callback`,
    },
    stdio: 'inherit',
  });

  backendProcess.on('exit', (code) => {
    console.log(`[seo-tool] backend process exited with code ${code}`);
  });
}

function waitForBackend(retries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      const req = http.get(`http://127.0.0.1:${PORT}/health`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (remaining <= 0) {
          reject(new Error('Backend did not start in time'));
          return;
        }
        setTimeout(() => attempt(remaining - 1), 500);
      });
    };
    attempt(retries);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SEO Tool',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  try {
    await waitForBackend();
  } catch (err) {
    console.error('[seo-tool]', err);
  }

  mainWindow.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(async () => {
  startBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (backendProcess) backendProcess.kill();
});
