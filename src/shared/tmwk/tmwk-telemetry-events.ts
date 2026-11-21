import { z } from 'zod'

// Only enums, small integers and the app version ever go on the wire (telemetry-plan).
const AppVersion = z
  .string()
  .max(32)
  .regex(/^\d+\.\d+\.\d+(?:[-+.][0-9A-Za-z.-]{1,24})?$/)
const Platform = z.enum(['darwin', 'linux', 'win32'])
const Arch = z.enum(['arm64', 'x64', 'ia32', 'arm'])
const Count = z.number().int().min(0).max(1_000_000)

const common = {
  app_version: AppVersion,
  platform: Platform,
  arch: Arch,
  session_id: z.string().uuid(),
  $process_person_profile: z.literal(false)
}

export const TMWK_ERROR_KINDS = ['rollover', 'summary', 'main-session', 'ticket-refresh'] as const

export const TMWK_TELEMETRY_EVENTS = {
  tmwk_app_opened: z.object({ ...common }).strict(),
  tmwk_errors_counted: z
    .object({ ...common, kind: z.enum(TMWK_ERROR_KINDS), count: Count })
    .strict(),
  tmwk_ticket_outcomes_counted: z
    .object({
      ...common,
      completed: Count,
      failed: Count,
      lost: Count,
      open: Count
    })
    .strict(),
  tmwk_rollovers_counted: z
    .object({ ...common, stored: Count, fallback: Count, stale: Count })
    .strict()
} as const

export type TmwkTelemetryEventName = keyof typeof TMWK_TELEMETRY_EVENTS
