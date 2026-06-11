import { Fragment, type ReactNode } from 'react';

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

/** 修补模型常输出的不完整 Markdown（如未闭合的 **） */
function repairInlineMarkdown(text: string): string {
  const trimmed = text.trim();
  if (
    trimmed.startsWith('**') &&
    trimmed.length > 2 &&
    trimmed.indexOf('**', 2) === -1
  ) {
    return `${trimmed}**`;
  }
  return text;
}

function parseInline(text: string, lineKey: number): ReactNode[] {
  const repaired = repairInlineMarkdown(text);
  const parts: ReactNode[] = [];
  let remaining = repaired;
  let partIndex = 0;

  while (remaining.length > 0) {
    const boldStart = remaining.indexOf('**');
    if (boldStart === -1) {
      parts.push(remaining);
      break;
    }

    if (boldStart > 0) {
      parts.push(remaining.slice(0, boldStart));
      remaining = remaining.slice(boldStart);
      continue;
    }

    const closeIndex = remaining.indexOf('**', 2);
    if (closeIndex === -1) {
      parts.push(<strong key={`${lineKey}-b-${partIndex++}`}>{remaining.slice(2)}</strong>);
      break;
    }

    const inner = remaining.slice(2, closeIndex);
    if (inner) {
      parts.push(<strong key={`${lineKey}-b-${partIndex++}`}>{inner}</strong>);
    }
    remaining = remaining.slice(closeIndex + 2);
  }

  return parts.length > 0 ? parts : [text];
}

const HEADING_RE = /^(#{1,3})\s*(.+)$/;
const BOLD_LINE_RE = /^\*\*(.+)\*\*$/;
const UL_RE = /^(?:[-*]|•)\s+(.+)$/;
const OL_RE = /^\d+[.)]\s+(.+)$/;

const SECTION_HEADINGS = [
  '写作趋势',
  '写作习惯',
  '情绪与主题',
  '一句建议',
] as const;

function matchSectionHeading(line: string): string | null {
  for (const title of SECTION_HEADINGS) {
    if (line === title || line.startsWith(`${title}（`) || line.startsWith(`${title}(`)) {
      return line;
    }
  }
  return null;
}

export function renderSimpleMarkdown(text: string): ReactNode {
  const lines = normalizeText(text).split('\n');
  const nodes: ReactNode[] = [];
  const ulItems: ReactNode[] = [];
  const olItems: ReactNode[] = [];
  let key = 0;

  const flushUl = () => {
    if (ulItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${key++}`}>{ulItems.splice(0, ulItems.length)}</ul>,
    );
  };

  const flushOl = () => {
    if (olItems.length === 0) return;
    nodes.push(
      <ol key={`ol-${key++}`}>{olItems.splice(0, olItems.length)}</ol>,
    );
  };

  const flushLists = () => {
    flushUl();
    flushOl();
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushLists();
      continue;
    }

    const heading = trimmed.match(HEADING_RE);
    if (heading) {
      flushLists();
      const level = heading[1].length;
      const content = parseInline(heading[2], key);
      if (level <= 2) {
        nodes.push(<h2 key={`h2-${key++}`}>{content}</h2>);
      } else {
        nodes.push(<h3 key={`h3-${key++}`}>{content}</h3>);
      }
      continue;
    }

    const sectionTitle = matchSectionHeading(trimmed);
    if (sectionTitle) {
      flushLists();
      nodes.push(<h2 key={`h2s-${key++}`}>{sectionTitle}</h2>);
      continue;
    }

    const boldLine = trimmed.match(BOLD_LINE_RE);
    if (boldLine) {
      flushLists();
      nodes.push(<h3 key={`h3b-${key++}`}>{boldLine[1]}</h3>);
      continue;
    }

    const ul = trimmed.match(UL_RE);
    if (ul) {
      flushOl();
      ulItems.push(<li key={`li-${key++}`}>{parseInline(ul[1], key)}</li>);
      continue;
    }

    const ol = trimmed.match(OL_RE);
    if (ol) {
      flushUl();
      olItems.push(<li key={`oli-${key++}`}>{parseInline(ol[1], key)}</li>);
      continue;
    }

    flushLists();
    nodes.push(<p key={`p-${key++}`}>{parseInline(trimmed, key)}</p>);
  }

  flushLists();

  if (nodes.length === 0 && text.trim()) {
    return <p>{parseInline(text.trim(), 0)}</p>;
  }

  return <Fragment>{nodes}</Fragment>;
}
