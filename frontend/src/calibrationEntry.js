// Navigation cues only. Learning completion remains entirely server-owned.
export function calibrationEntry(status, count) {
  if (!status || !['sample', 'sweep', 'done'].includes(status.mode) ||
      !Array.isArray(status.steps) || !Number.isInteger(count?.known) || count.known < 0) return null;
  if (status.mode === 'done') return 'done';
  if (status.steps.length > 0) return 'partial';
  return count.known === 0 ? 'fresh' : 'configured';
}
