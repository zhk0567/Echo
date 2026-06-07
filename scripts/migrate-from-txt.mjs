import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TXT_PATH = path.join(ROOT, '日记.txt');
const ENTRIES_DIR = path.join(ROOT, 'entries');

const DATE_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;

function toIsoDate(dateStr) {
  const [y, m, d] = dateStr.split('.');
  return `${y}-${m}-${d}`;
}

function parseDiaryTxt(content) {
  const segments = content.split('\r');
  const entries = [];
  let currentDate = null;
  let currentLines = [];

  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    if (DATE_PATTERN.test(trimmed)) {
      if (currentDate) {
        entries.push({
          date: toIsoDate(currentDate),
          content: currentLines.join('\n').trim(),
        });
      }
      currentDate = trimmed;
      currentLines = [];
    } else if (currentDate) {
      currentLines.push(segment);
    }
  }

  if (currentDate) {
    entries.push({
      date: toIsoDate(currentDate),
      content: currentLines.join('\n').trim(),
    });
  }

  return entries;
}

function migrate() {
  if (!fs.existsSync(TXT_PATH)) {
    console.error('未找到 日记.txt');
    process.exit(1);
  }

  if (!fs.existsSync(ENTRIES_DIR)) {
    fs.mkdirSync(ENTRIES_DIR, { recursive: true });
  }

  const content = fs.readFileSync(TXT_PATH, 'utf-8');
  const entries = parseDiaryTxt(content);
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  for (const entry of entries) {
    const filePath = path.join(ENTRIES_DIR, `${entry.date}.json`);
    if (fs.existsSync(filePath)) {
      skipped++;
      continue;
    }

    const record = {
      date: entry.date,
      content: entry.content,
      createdAt: `${entry.date}T00:00:00.000Z`,
      updatedAt: now,
    };

    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
    created++;
  }

  console.log(`迁移完成：新建 ${created} 条，跳过 ${skipped} 条，共解析 ${entries.length} 条`);
}

migrate();
