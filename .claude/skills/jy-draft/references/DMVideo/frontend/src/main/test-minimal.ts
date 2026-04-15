// 最小测试 - 不导入任何自定义模块
const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('App object:', app);
console.log('App name:', app?.getName?.());

app.disableHardwareAcceleration();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});