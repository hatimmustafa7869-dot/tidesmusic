// If executed in Node.js (Hostinger / LiteSpeed / Web Server), delegate to server.js
if (!process.versions || !process.versions.electron) {
  require('../server.js');
} else {
  // Desktop Electron runner
  const { app, BrowserWindow, globalShortcut, Tray, Menu } = require('electron');
  const path = require('path');

  let mainWindow;
  let tray = null;

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 850,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#000000',
      title: 'Tides Music Player',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const port = process.env.PORT || 8000;
    mainWindow.loadURL(`http://127.0.0.1:${port}`);

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    globalShortcut.register('MediaPlayPause', () => {
      mainWindow && mainWindow.webContents.send('media-play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
      mainWindow && mainWindow.webContents.send('media-next');
    });
    globalShortcut.register('MediaPreviousTrack', () => {
      mainWindow && mainWindow.webContents.send('media-prev');
    });
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

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });
}
