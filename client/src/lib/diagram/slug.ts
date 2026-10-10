/**
 * Stable, readable ids derived from labels. Ids must not change when the user
 * edits unrelated lines, otherwise manually dragged positions would jump around.
 */
export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'node'
  );
}
