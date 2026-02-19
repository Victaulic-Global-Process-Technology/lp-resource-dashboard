/**
 * Get the parent project ID from a sub-project code.
 * Examples: R1337.1 → R1337, R1430.1A → R1430, S0062 → S0062
 */
export function getProjectParent(projectId: string): string {
  const dotIndex = projectId.indexOf('.');
  if (dotIndex === -1) return projectId;
  return projectId.substring(0, dotIndex);
}
