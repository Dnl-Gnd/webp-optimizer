export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function savingPercent(original: number, optimized: number) {
  if (!original) return 0;
  return Math.round((1 - optimized / original) * 100);
}

export function toWebpName(name: string) {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.webp`;
}
