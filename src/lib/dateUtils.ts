export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(year, month - 1, day);
  return `${year}年${month}月${day}日 星期${weekdays[date.getDay()]}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFirstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

export function shiftDate(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getRelativeDateLabel(dateStr: string): string {
  const today = getTodayIso();
  if (dateStr === today) return '今天';

  const yesterday = shiftDate(today, -1);
  if (dateStr === yesterday) return '昨天';

  const [y1, m1, d1] = dateStr.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  const target = new Date(y1, m1 - 1, d1);
  const now = new Date(y2, m2 - 1, d2);
  const diffDays = Math.round((now.getTime() - target.getTime()) / 86400000);

  if (diffDays > 0 && diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 0 && diffDays > -7) return `${-diffDays} 天后`;
  return '记录生活，留住时光';
}
