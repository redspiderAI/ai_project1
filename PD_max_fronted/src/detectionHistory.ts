import type {
  DetectionHistoryApiRecord,
  V3ResultItem,
} from './api/detect'

export type HistoryPayload = {
  result?: V3ResultItem | null
  multi?: V3ResultItem[]
  error_msg?: string | null
}

export type DetectionHistoryEntry = {
  id: string
  savedAt: string
  taskId: string
  fileName: string
  imageUrl: string
  payload: HistoryPayload
  status: 'COMPLETED' | 'FAILED'
  mode?: string
}

export function mapApiRecordToEntry(r: DetectionHistoryApiRecord): DetectionHistoryEntry {
  const oc = r.outcome ?? {}
  const payload: HistoryPayload = {
    result: oc.result ?? null,
    multi: oc.multi_results,
    error_msg: oc.error_msg ?? null,
  }
  const name = r.original_filename?.trim()
  return {
    id: String(r.id),
    savedAt: r.created_at,
    taskId: (r.task_id ?? '').trim(),
    fileName: name || '未命名图片',
    imageUrl: (r.image_url ?? '').trim(),
    payload,
    status: r.status?.toUpperCase() === 'FAILED' ? 'FAILED' : 'COMPLETED',
    mode: r.mode,
  }
}
