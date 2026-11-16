/** Boot gate. Implemented with the motion milestone (PRD §5.2); until then the page opens directly. */
export function initGate(): void {
  document.documentElement.removeAttribute('data-gate');
}
