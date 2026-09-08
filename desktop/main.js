const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PORT = 4573;
const UPDATE_REPO = 'lekhoa1509/seo-tool';

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

function parseVersion(v) {
  return String(v || '')
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

function isNewerVersion(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

async function downloadToFile(url, destPath, onProgress) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Tải file thất bại (HTTP ${res.status})`);
  }

  const total = Number(res.headers.get('content-length') || 0);
  let received = 0;

  const fileStream = fs.createWriteStream(destPath);
  const reader = res.body.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    fileStream.write(Buffer.from(value));
    if (total && onProgress) onProgress(Math.round((received / total) * 100));
  }

  await new Promise((resolve, reject) => {
    fileStream.end((err) => (err ? reject(err) : resolve()));
  });
}

function registerUpdateHandlers() {
  ipcMain.handle('update:check', async () => {
    const current = app.getVersion();

    try {
      const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (!res.ok) {
        throw new Error(`GitHub API trả về lỗi ${res.status}`);
      }

      const data = await res.json();
      const latestTag = data.tag_name || '';
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const pkgAsset = assets.find((a) => a.name.endsWith('.pkg'));
      const dmgAsset = assets.find((a) => a.name.endsWith('.dmg'));

      return {
        ok: true,
        current,
        latest: latestTag.replace(/^v/, ''),
        hasUpdate: isNewerVersion(latestTag, current),
        notes: data.body || '',
        pkg: pkgAsset
          ? { name: pkgAsset.name, url: pkgAsset.browser_download_url, size: pkgAsset.size }
          : null,
        dmg: dmgAsset
          ? { name: dmgAsset.name, url: dmgAsset.browser_download_url, size: dmgAsset.size }
          : null,
      };
    } catch (err) {
      return { ok: false, current, error: err.message };
    }
  });

  ipcMain.handle('update:download-and-install', async (event, asset) => {
    if (!asset?.url || !asset?.name) {
      throw new Error('Thiếu thông tin file cập nhật');
    }

    const destPath = path.join(app.getPath('downloads'), asset.name);

    await downloadToFile(asset.url, destPath, (percent) => {
      event.sender.send('update:download-progress', percent);
    });

    if (!destPath.endsWith('.pkg')) {
      // Only .pkg supports the silent `installer` CLI below; anything else
      // (e.g. .dmg) falls back to opening it for the user to install by hand.
      await shell.openPath(destPath);
      return { path: destPath, installed: false };
    }

    event.sender.send('update:install-status', 'installing');

    try {
      await installPkgSilently(destPath);
    } catch (err) {
      // User cancelled the password prompt, or the install failed. Fall back
      // to just opening the installer so they can finish it by hand.
      await shell.openPath(destPath);
      throw new Error(`Cài ngầm thất bại (${err.message}). Đã mở trình cài đặt để bạn cài thủ công.`);
    }

    event.sender.send('update:install-status', 'restarting');
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 800);

    return { path: destPath, installed: true };
  });
}

async function installPkgSilently(pkgPath) {
  // `installer -pkg ... -target /` needs root. Routing it through
  // `osascript ... with administrator privileges` shows the native macOS
  // password/Touch ID prompt (one click) instead of a Terminal window, and
  // runs the installer with no GUI wizard (no Continue/Install/Close clicks).
  const shellCommand = `installer -pkg ${JSON.stringify(pkgPath)} -target /`;
  const appleScript = `do shell script ${JSON.stringify(shellCommand)} with administrator privileges`;
  await execFileAsync('osascript', ['-e', appleScript]);
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
      preload: path.join(__dirname, 'preload.js'),
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
  registerUpdateHandlers();
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
