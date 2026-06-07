/** 统一换行为 LF，避免 Windows 下 \r\n 被重复计入 */
export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** 字数：不含换行符的正文字符数 */
export function countDiaryChars(text: string): number {
  return normalizeNewlines(text).replace(/\n/g, '').length;
}
