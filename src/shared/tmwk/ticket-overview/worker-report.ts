/** A worker's structured report, which Orca stores as JSON in the Task result. */
export type WorkerReport = { subject: string; body: string | null }

/** The report in a Task result, or null for a plain-text result. */
export function parseWorkerReport(result: string | null): WorkerReport | null {
  try {
    const report: unknown = JSON.parse(result ?? '')
    if (
      typeof report === 'object' &&
      report !== null &&
      'subject' in report &&
      typeof report.subject === 'string' &&
      report.subject.trim()
    ) {
      const body = 'body' in report && typeof report.body === 'string' ? report.body.trim() : ''
      return { subject: report.subject.trim(), body: body || null }
    }
  } catch {
    // Plain-text results are not reports.
  }
  return null
}
