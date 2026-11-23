// The observed-setup wrapper's whole result line (setup-completion-signal.ts) with its randomUUID token.
const OBSERVED_SETUP_RESULT_LINE =
  /^__ORCA_SETUP_COMPLETE__:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}:(-?\d+)$/
// A single-line prompt; a two-line prompt or a command run since reads as more and keeps the terminal.
const MAX_LINES_AFTER_RESULT = 1

/** Whether a restored screen ends with an observed setup that exited 0 and at most a single-line prompt since.
 * A nonce-carrying success line is never read here: its nonce died with the process that minted it,
 * so a restored screen cannot tell a real one from printed text. Those runs close on the live path. */
export function readIdleSetupTerminalOutcome(lines: readonly string[]): 'succeeded' | 'unknown' {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const result = OBSERVED_SETUP_RESULT_LINE.exec(lines[index].trim())
    if (!result) {
      continue
    }
    const linesAfter = lines.slice(index + 1).filter((line) => line.trim().length > 0)
    return result[1] === '0' && linesAfter.length <= MAX_LINES_AFTER_RESULT
      ? 'succeeded'
      : 'unknown'
  }
  return 'unknown'
}
