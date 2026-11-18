export type TmwkRecordKind = 'preference' | 'note'

export type TmwkRecord = {
  id: string
  kind: TmwkRecordKind
  text: string
  project: { repoId: string; name: string } | null
  source: string | null
  createdAt: string
  supersedes: string | null
  supersededBy: string | null
  retiredAt: string | null
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTmwkProject(value: unknown): value is TmwkRecord['project'] {
  if (value === null) {
    return true
  }
  return (
    typeof value === 'object' &&
    'repoId' in value &&
    typeof value.repoId === 'string' &&
    'name' in value &&
    typeof value.name === 'string'
  )
}

export function isTmwkRecord(value: unknown): value is TmwkRecord {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'kind' in value &&
    (value.kind === 'preference' || value.kind === 'note') &&
    'text' in value &&
    typeof value.text === 'string' &&
    'project' in value &&
    isTmwkProject(value.project) &&
    'source' in value &&
    isNullableString(value.source) &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    'supersedes' in value &&
    isNullableString(value.supersedes) &&
    'supersededBy' in value &&
    isNullableString(value.supersededBy) &&
    'retiredAt' in value &&
    isNullableString(value.retiredAt)
  )
}
