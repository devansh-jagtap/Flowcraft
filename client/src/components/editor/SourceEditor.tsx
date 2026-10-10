import { useRef, type KeyboardEvent } from 'react';
import type { DiagramType, ParseIssue } from '../../lib/diagram/types';

const INDENT = '  ';

const HELP: Record<DiagramType, { syntax: string; meaning: string }[]> = {
  flowchart: [
    { syntax: 'A -> B -> C', meaning: 'steps connected by arrows' },
    { syntax: 'Ready?', meaning: 'ending with ? makes a decision' },
    { syntax: 'Ready? -> Go: yes', meaning: 'label an arrow after ": "' },
    { syntax: '(Start)', meaning: 'round start / end step' },
    { syntax: '# note', meaning: 'comment, ignored' },
  ],
  mindmap: [
    { syntax: 'Main idea', meaning: 'first line is the centre' },
    { syntax: '  Topic', meaning: 'indent to branch out (Tab)' },
    { syntax: '    Detail', meaning: 'indent more to go deeper' },
  ],
  orgchart: [
    { syntax: 'Name: Role', meaning: 'adds a second line to the card' },
    { syntax: '  Report', meaning: 'indent = reports to the line above' },
    { syntax: 'Shift+Tab', meaning: 'move a line back out' },
  ],
};

interface Props {
  type: DiagramType;
  value: string;
  onChange: (value: string) => void;
  issues: ParseIssue[];
  readOnly?: boolean;
}

/** Plain textarea with Tab / Shift+Tab indentation, which tree diagrams depend on. */
export default function SourceEditor({ type, value, onChange, issues, readOnly }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab') return;
    e.preventDefault();

    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;

    let next: string;
    let cursor: number;
    if (e.shiftKey) {
      const removable = value.slice(lineStart, lineStart + INDENT.length).match(/^ {1,2}|^\t/)?.[0] ?? '';
      if (!removable) return;
      next = value.slice(0, lineStart) + value.slice(lineStart + removable.length);
      cursor = Math.max(lineStart, start - removable.length);
    } else {
      next = value.slice(0, start) + INDENT + value.slice(end);
      cursor = start + INDENT.length;
    }

    onChange(next);
    // Restore the caret after React re-renders the controlled value.
    requestAnimationFrame(() => ref.current?.setSelectionRange(cursor, cursor));
  }

  return (
    <div className="source-editor">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        readOnly={readOnly}
        aria-label="Diagram text"
        placeholder="Type your diagram here…"
      />

      {issues.length > 0 && (
        <ul className="issues">
          {issues.slice(0, 4).map((issue, i) => (
            <li key={i}>
              {issue.line > 0 && <strong>Line {issue.line}: </strong>}
              {issue.message}
            </li>
          ))}
        </ul>
      )}

      <details className="syntax-help">
        <summary>How to write {type === 'orgchart' ? 'an org chart' : type === 'mindmap' ? 'a mind map' : 'a flowchart'}</summary>
        <dl>
          {HELP[type].map((row) => (
            <div key={row.syntax}>
              <dt>
                <code>{row.syntax}</code>
              </dt>
              <dd>{row.meaning}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
