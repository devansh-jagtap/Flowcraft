import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

export type ExportFormat = 'png' | 'svg';

const PADDING = 40;

/**
 * Renders the whole diagram (not just the visible part of the canvas) to an
 * image by temporarily applying a transform that fits all nodes.
 */
export async function exportDiagram(nodes: Node[], format: ExportFormat, fileName: string, background: string) {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport || nodes.length === 0) throw new Error('Nothing to export yet');

  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);
  const { x, y, zoom } = getViewportForBounds(bounds, width, height, 1, 1, 0);

  const options = {
    backgroundColor: background,
    width,
    height,
    pixelRatio: 2,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${x + PADDING}px, ${y + PADDING}px) scale(${zoom})` },
  };

  const dataUrl = format === 'png' ? await toPng(viewport, options) : await toSvg(viewport, options);
  const link = document.createElement('a');
  link.download = `${fileName.replace(/[^\w\- ]+/g, '').trim() || 'diagram'}.${format}`;
  link.href = dataUrl;
  link.click();
}
