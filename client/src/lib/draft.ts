import type { DiagramDraft, GeneratedDiagram } from '../api/types';

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

/** Set when a guest clicks "Save"; the dashboard imports the draft right after they sign in. */
export const pendingImport = {
  mark: () => localStorage.setItem(IMPORT_FLAG, '1'),
  take(): DiagramDraft | null {
    if (!localStorage.getItem(IMPORT_FLAG)) return null;
    localStorage.removeItem(IMPORT_FLAG);
    const draft = guestDraft.load();
    guestDraft.clear();
    return draft;
  },
};

const THEME_FOR_TYPE = { flowchart: 'ocean', mindmap: 'grape', orgchart: 'forest' } as const;

/** Builds a new draft from an AI result, remembering the prompt that created it. */
export function draftFromGenerated(diagram: GeneratedDiagram, prompt: string): DiagramDraft {
  return {
    ...diagram,
    theme: THEME_FOR_TYPE[diagram.type],
    positions: {},
    prompts: [{ text: prompt, createdAt: new Date().toISOString() }],
  };
}
