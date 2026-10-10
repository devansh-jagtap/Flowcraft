/** Example prompts shown as one-click chips. */
export const EXAMPLE_PROMPTS = [
  'How does online food delivery work, from order to doorstep?',
  'Mind map for learning Python in 3 months',
  'Org chart for a small restaurant',
  'Steps to apply for a passport in India',
  'Plan a birthday party on a budget',
  'How a bug goes from report to fix in a software team',
  'ER diagram for a college database',
  'UML class diagram for a library system',
  'Sequence diagram for logging in to a website',
];

import type { DiagramType } from './diagram/types';

/** Follow-up suggestions in the editor, tailored to the current diagram type. */
export const REFINE_EXAMPLES: Record<DiagramType, string[]> = {
  flowchart: ['Add what happens when something fails', 'Make it more detailed', 'Turn this into a mind map', 'Translate to Hindi'],
  mindmap: ['Add more detail to each branch', 'Make it simpler', 'Turn this into a flowchart', 'Translate to Hindi'],
  orgchart: ['Add a marketing team', 'Add job titles for everyone', 'Turn this into a mind map', 'Translate to Hindi'],
  er: ['Add a Payment entity', 'Mark the key attributes', 'Add cardinalities to every relationship', 'Turn this into a class diagram'],
  class: ['Add getters and setters', 'Add an interface for payments', 'Show multiplicities on associations', 'Turn this into an ER diagram'],
  usecase: ['Add an admin actor', 'Add a login use case others include', 'Add what extends checkout', 'Turn this into a sequence diagram'],
  sequence: ['Add error handling with alt/else', 'Add a cache before the database', 'Add a retry loop', 'Turn this into a flowchart'],
  state: ['Add a cancelled state', 'Add a retry transition', 'Label every transition with its event', 'Turn this into a flowchart'],
};
