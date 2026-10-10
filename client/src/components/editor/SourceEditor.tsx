import { useRef, type KeyboardEvent } from 'react';
import { TYPE_INFO } from '../../lib/diagram/templates';
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
  er: [
    { syntax: 'Student', meaning: 'an entity (rectangle)' },
    { syntax: '  Roll no (key)', meaning: 'indented: attribute; (key) underlines it' },
    { syntax: '    First name', meaning: 'indent again for a composite attribute' },
    { syntax: '(multivalued) (derived)', meaning: 'double or dashed oval' },
    { syntax: 'Dependent (weak)', meaning: 'weak entity; (partial key) on its attribute' },
    { syntax: 'A -- Rel -- B: 1:N', meaning: 'relationship diamond with cardinality' },
    { syntax: 'A == Rel', meaning: 'double line: total participation' },
    { syntax: 'Rel (relationship)', meaning: 'declare a relationship to give it attributes' },
  ],
  class: [
    { syntax: 'class User', meaning: 'also interface, abstract class, enum' },
    { syntax: '  - name: String', meaning: 'indented: attribute' },
    { syntax: '  + login(): bool', meaning: 'has "(": method' },
    { syntax: 'Admin --|> User', meaning: 'inheritance (..|> implements)' },
    { syntax: 'Order *-- Line', meaning: 'composition (o-- aggregation)' },
    { syntax: 'A --> B   A ..> B', meaning: 'association, dependency' },
    { syntax: 'A "1" -- "*" B: has', meaning: 'multiplicities and a label' },
  ],
  usecase: [
    { syntax: 'system Shop', meaning: 'names the system boundary' },
    { syntax: 'Customer -> Pay', meaning: 'actor uses a use case' },
    { syntax: 'actor Bank', meaning: 'declare actors on the right side' },
    { syntax: 'Pay -> Log in: include', meaning: '«include» (or extend)' },
    { syntax: 'Guest --|> User', meaning: 'generalisation' },
  ],
  sequence: [
    { syntax: 'actor User', meaning: 'also participant, database' },
    { syntax: 'A -> B: call', meaning: 'message (solid arrow)' },
    { syntax: 'B --> A: result', meaning: 'reply (dashed)' },
    { syntax: 'A -) B: event', meaning: 'asynchronous message' },
    { syntax: 'alt ok … else … end', meaning: 'also loop, opt, par' },
  ],
  state: [
    { syntax: '[*] -> Idle', meaning: 'initial state' },
    { syntax: 'Idle -> Busy: start', meaning: 'transition with its event' },
    { syntax: 'Valid?', meaning: 'ending with ? makes a choice' },
    { syntax: 'Done -> [*]', meaning: 'final state' },
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
        <summary>How to write {TYPE_INFO[type].article}</summary>
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
