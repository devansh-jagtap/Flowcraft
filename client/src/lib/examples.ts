/** Example prompts shown as one-click chips. */
export const EXAMPLE_PROMPTS = [
  'How does online food delivery work, from order to doorstep?',
  'Mind map for learning Python in 3 months',
  'Org chart for a small restaurant',
  'Steps to apply for a passport in India',
  'Plan a birthday party on a budget',
  'How a bug goes from report to fix in a software team',
];

import type { DiagramType } from './diagram/types';

/** Follow-up suggestions in the editor, tailored to the current diagram type. */
export const REFINE_EXAMPLES: Record<DiagramType, string[]> = {
  flowchart: ['Add what happens when something fails', 'Make it more detailed', 'Turn this into a mind map', 'Translate to Hindi'],
  mindmap: ['Add more detail to each branch', 'Make it simpler', 'Turn this into a flowchart', 'Translate to Hindi'],
  orgchart: ['Add a marketing team', 'Add job titles for everyone', 'Turn this into a mind map', 'Translate to Hindi'],
};
