import { app } from 'electron';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILENAME = 'export-settings.json';
const DEFAULT_FILENAME = '日记.txt';

interface ExportSettingsFile {
  lastExportPath?: string;
}

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

function readSettings(): ExportSettingsFile {
  const filePath = getSettingsFilePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ExportSettingsFile;
  } catch {
    return {};
  }
}

function writeSettings(data: ExportSettingsFile): void {
  const filePath = getSettingsFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 迁移旧版写在应用根目录的设置 */
export function migrateExportSettingsFromAppRoot(appRoot: string): void {
  if (readSettings().lastExportPath) return;
  const legacyPath = path.join(appRoot, SETTINGS_FILENAME);
  if (!fs.existsSync(legacyPath)) return;
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf-8')) as ExportSettingsFile;
    if (legacy.lastExportPath?.trim()) {
      writeSettings({ lastExportPath: path.normalize(legacy.lastExportPath.trim()) });
    }
  } catch {
    // ignore
  }
}

/** 保存对话框 defaultPath：上次完整路径，否则「文档/日记.txt」 */
export function getDefaultExportPath(): string {
  const saved = readSettings().lastExportPath?.trim();
  if (saved) {
    const dir = path.dirname(saved);
    if (fs.existsSync(dir)) return saved;
  }
  return path.join(app.getPath('documents'), DEFAULT_FILENAME);
}

export function rememberExportPath(filePath: string): void {
  const normalized = path.normalize(filePath.trim());
  if (!normalized) return;
  writeSettings({ lastExportPath: normalized });
}
