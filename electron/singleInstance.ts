import { execFileSync } from 'child_process';
import { app, BrowserWindow } from 'electron';

function killOtherDevInstances(): void {
  const currentPid = process.pid;

  const lines = [
    `$me = ${currentPid}`,
    `Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |`,
    `  Where-Object {`,
    `    $_.ProcessId -ne $me -and $_.Name -eq 'electron.exe' -and $_.CommandLine -like '*echo-diary*'`,
    `  } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
  ];

  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', lines.join('\n')],
      { stdio: 'ignore', windowsHide: true },
    );
  } catch {
    // ignore — best effort
  }
}

export function enforceSingleInstance(getWindow: () => BrowserWindow | null): boolean {
  // Packaged: rely on requestSingleInstanceLock only — killing by process name
  // hits Chromium child processes that share the same image name on Windows.
  if (process.platform === 'win32' && !app.isPackaged) {
    killOtherDevInstances();
  }

  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return false;
  }

  app.on('second-instance', () => {
    const win = getWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  });

  return true;
}
