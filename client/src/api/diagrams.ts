import { api } from './client';
import type { Diagram, DiagramDraft, DiagramStats, SharedDiagram } from './types';

export interface ListParams {
  q?: string;
  type?: string;
  sort?: string;
  starred?: string;
}

export const diagramsApi = {
  list: (query: ListParams, signal?: AbortSignal) =>
    api.get<{ diagrams: Diagram[] }>('/diagrams', { query: { ...query }, signal }).then((r) => r.diagrams),
  stats: (signal?: AbortSignal) => api.get<DiagramStats>('/diagrams/stats', { signal }),
  get: (id: string, signal?: AbortSignal) => api.get<{ diagram: Diagram }>(`/diagrams/${id}`, { signal }).then((r) => r.diagram),
  create: (draft: Partial<DiagramDraft> & Pick<DiagramDraft, 'type'>) =>
    api.post<{ diagram: Diagram }>('/diagrams', draft).then((r) => r.diagram),
  update: (id: string, changes: Partial<DiagramDraft> & { starred?: boolean }) =>
    api.patch<{ diagram: Diagram }>(`/diagrams/${id}`, changes).then((r) => r.diagram),
  remove: (id: string) => api.delete(`/diagrams/${id}`),
  duplicate: (id: string) => api.post<{ diagram: Diagram }>(`/diagrams/${id}/duplicate`).then((r) => r.diagram),
  share: (id: string, isPublic: boolean) =>
    api.post<{ diagram: Diagram }>(`/diagrams/${id}/share`, { isPublic }).then((r) => r.diagram),
  getShared: (shareId: string, signal?: AbortSignal) =>
    api.get<{ diagram: SharedDiagram }>(`/shared/${shareId}`, { signal }).then((r) => r.diagram),
  fork: (shareId: string) => api.post<{ diagram: Diagram }>(`/shared/${shareId}/fork`).then((r) => r.diagram),
};
