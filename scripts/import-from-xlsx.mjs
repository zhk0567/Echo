import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'zhita_settings.xlsx');
const ENTRIES_DIR = path.join(ROOT, 'entries');
const DIARY_SHEET = '日记';

function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function parseXlsxDate(value) {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const m = String(parsed.m).padStart(2, '0');
    const d = String(parsed.d).padStart(2, '0');
    return `${parsed.y}-${m}-${d}`;
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function importDiaries() {
  if (!fs.existsSync(XLSX_PATH)) {
    console.error('未找到 zhita_settings.xlsx');
    process.exit(1);
  }

  if (!fs.existsSync(ENTRIES_DIR)) {
    fs.mkdirSync(ENTRIES_DIR, { recursive: true });
  }

  const workbook = XLSX.readFile(XLSX_PATH);
  const sheet = workbook.Sheets[DIARY_SHEET];
  if (!sheet) {
    console.error(`未找到工作表「${DIARY_SHEET}」`);
    process.exit(1);
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  let invalid = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 2) continue;

    const date = parseXlsxDate(row[0]);
    if (!date) {
      invalid++;
      continue;
    }

    const content = normalizeNewlines(String(row[1] ?? '')).trim();
    if (!content) {
      invalid++;
      continue;
    }

    const filePath = path.join(ENTRIES_DIR, `${date}.json`);
    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    const record = {
      date,
      content,
      createdAt: `${date}T00:00:00.000Z`,
      updatedAt: now,
    };

    fs.writeFileSync(filePath, JSON.stringify(record), 'utf-8');
    created++;
  }

  console.log(
    `导入完成：新建 ${created} 条，跳过已有 ${skipped} 条，无效行 ${invalid} 条，共解析 ${rows.length - 1} 行`,
  );
}

importDiaries();
