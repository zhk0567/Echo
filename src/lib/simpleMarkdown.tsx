import { Fragment, type ReactNode } from 'react';

function parseInline(text: string, lineKey: number): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`${lineKey}-b-${partIndex++}`}>{match[1]}</strong>,
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function renderSimpleMarkdown(text: string): ReactNode {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  const listItems: ReactNode[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${key++}`}>
        {listItems.splice(0, listItems.length)}
      </ul>,
    );
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    if (trimmed.startsWith('### ')) {
      flushList();
      nodes.push(
        <h3 key={`h3-${key++}`}>{parseInline(trimmed.slice(4), key)}</h3>,
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      nodes.push(
        <h2 key={`h2-${key++}`}>{parseInline(trimmed.slice(3), key)}</h2>,
      );
      continue;
    }

    if (trimmed.startsWith('- ')) {
      listItems.push(
        <li key={`li-${key++}`}>{parseInline(trimmed.slice(2), key)}</li>,
      );
      continue;
    }

    if (trimmed === '') {
      flushList();
      continue;
    }

    flushList();
    nodes.push(
      <p key={`p-${key++}`}>{parseInline(trimmed, key)}</p>,
    );
  }

  flushList();

  return <Fragment>{nodes}</Fragment>;
}
