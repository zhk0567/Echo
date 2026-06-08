/** 统一换行为 LF，避免 Windows 下 \r\n 被重复计入 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** 字数：不含换行符的正文字符数 */
export function countDiaryChars(text: string): number {
  return normalizeNewlines(text).replace(/\n/g, '').length;
}

/** 热力等级：0 无内容，1 少，2 中，3 多 */
export function getHeatLevel(chars: number): 0 | 1 | 2 | 3 {
  if (chars <= 0) return 0;
  if (chars >= 800) return 3;
  if (chars >= 200) return 2;
  return 1;
}
