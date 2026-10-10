import type { DiagramType } from '../lib/diagram/types';
import { api } from './client';
import type { GeneratedDiagram } from './types';

let statusPromise: Promise<boolean> | null = null;

export const aiApi = {
  /** Whether the server has an AI key (AI Gateway or Gemini). Cached for the session; retried after a failure. */
  enabled(): Promise<boolean> {
    statusPromise ??= api
      .get<{ enabled: boolean }>('/ai/status')
      .then((r) => r.enabled)
      .catch(() => {
        statusPromise = null;
        return false;
      });
    return statusPromise;
  },

  generate: (prompt: string, current?: { type: DiagramType; source: string }) =>
    api.post<{ diagram: GeneratedDiagram }>('/ai/generate', { prompt, current }).then((r) => r.diagram),
};
