/** Sound toggle wiring. The engine itself arrives with the sound milestone (PRD §7); until then the toggle stays hidden. */
export function initSound(): void {
  for (const btn of document.querySelectorAll<HTMLElement>('[data-sound-toggle]')) btn.hidden = true;
}
