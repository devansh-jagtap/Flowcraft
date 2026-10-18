import type { DiagramDraft, GeneratedDiagram } from '../api/types';
import type { DiagramType, ThemeName } from './diagram/types';

const KEY = 'flowcraft.guestDraft';

/** Guests can build a diagram before signing up; it is kept here until they log in. */
export const guestDraft = {
  load(): DiagramDraft | null {
    try {
      const raw = localStorage.getItem(KEY);
      // Drafts saved by older versions may lack newer fields.
      return raw ? { positions: {}, prompts: [], ...(JSON.parse(raw) as Partial<DiagramDraft>) } as DiagramDraft : null;
    } catch {
      return null;
    }
  },
  save(draft: DiagramDraft) {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      /* storage full or disabled: the draft simply is not persisted */
    }
  },
  clear() {
    localStorage.removeItem(KEY);
  },
};

const IMPORT_FLAG = 'flowcraft.importDraftAfterLogin';

/**
 * Set when a guest clicks "Sign up to save"; the dashboard imports the draft right after they sign in.
 * The draft stays in the browser until the import succeeds, so a failed request loses nothing.
 */
export const pendingImport = {
  mark: () => localStorage.setItem(IMPORT_FLAG, '1'),
  peek(): DiagramDraft | null {
    return localStorage.getItem(IMPORT_FLAG) ? guestDraft.load() : null;
  },
  done() {
    localStorage.removeItem(IMPORT_FLAG);
    guestDraft.clear();
  },
};

const THEME_FOR_TYPE: Record<DiagramType, ThemeName> = {
  flowchart: 'ocean',
  mindmap: 'grape',
  orgchart: 'forest',
  er: 'ocean',
  class: 'grape',
  usecase: 'forest',
  sequence: 'ocean',
  state: 'sunset',
};

/** Builds a new draft from an AI result, remembering the prompt that created it. */
export function draftFromGenerated(diagram: GeneratedDiagram, prompt: string): DiagramDraft {
  return {
    ...diagram,
    theme: THEME_FOR_TYPE[diagram.type],
    positions: {},
    prompts: [{ text: prompt, createdAt: new Date().toISOString() }],
  };
}
