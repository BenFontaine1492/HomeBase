import { t } from '@/i18n'
import { isValidIsoDate } from '@/utils/date'
import { normaliseText } from '@/utils/text'

/**
 * One entry of an object's maintenance history: what was done and when.
 * Receipts are attachments of the record.
 */
export interface MaintenanceRecord {
  id: number
  objectId: number
  /** The task this fulfilled; null for one-off work, or when the task was deleted. */
  taskId: number | null
  /** 'YYYY-MM-DD' */
  date: string
  /** Integer cents. */
  costCents: number | null
  /** Who did it, e.g. a company. */
  provider: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a record, for creating and updating. */
export interface MaintenanceRecordInput {
  taskId: number | null
  date: string
  costCents?: number | null
  provider?: string | null
  notes?: string | null
}

/** The fields of a record, validated and normalised (value object). Only `from()` can create one. */
export class MaintenanceRecordValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'MaintenanceRecordValues'

  readonly taskId: number | null
  /** 'YYYY-MM-DD' */
  readonly date: string
  /** Integer cents, never negative. */
  readonly costCents: number | null
  readonly provider: string | null
  readonly notes: string | null

  private constructor(fields: Omit<MaintenanceRecordValues, 'brand'>) {
    this.taskId = fields.taskId
    this.date = fields.date
    this.costCents = fields.costCents
    this.provider = fields.provider
    this.notes = fields.notes
  }

  static from(input: MaintenanceRecordInput): MaintenanceRecordValues {
    if (input.taskId !== null && !Number.isSafeInteger(input.taskId)) throw new Error(t('errors.record.invalidTask'))
    const date = input.date.trim()
    if (!isValidIsoDate(date)) throw new Error(t('errors.record.dateRequired'))
    const cost = input.costCents ?? null
    if (cost !== null && (!Number.isSafeInteger(cost) || cost < 0)) {
      throw new Error(t('errors.record.invalidCost'))
    }
    return new MaintenanceRecordValues({
      taskId: input.taskId,
      date,
      costCents: cost,
      provider: normaliseText(input.provider),
      notes: normaliseText(input.notes),
    })
  }
}
