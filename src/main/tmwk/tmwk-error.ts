// The dispatcher maps unknown error codes to runtime_error, so the code leads the message for the CLI to recover.
export function tmwkError(code: string, message: string): Error {
  return new Error(`tmwk_${code}: ${message}`)
}
