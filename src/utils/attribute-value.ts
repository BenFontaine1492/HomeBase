import { formatPreferences, t } from '@/i18n'
import type { HouseholdObjectAttribute } from '@/types/household-object-attribute'
import { formatDate } from './date'

/** Display text of an attribute value, e.g. "12.5 kW", "Yes", "4 Mar 2026". null = no value. */
export function formatAttributeValue(
  attribute: Pick<HouseholdObjectAttribute, 'valueType' | 'value' | 'unit'>,
): string | null {
  const { valueType, value, unit } = attribute
  if (value === null) return null
  switch (valueType) {
    case 'number': {
      const number = new Intl.NumberFormat(formatPreferences.locale, { maximumFractionDigits: 10 }).format(
        Number(value),
      )
      return unit ? `${number} ${unit}` : number
    }
    case 'boolean':
      return value === '1' ? t('common.yes') : t('common.no')
    case 'date':
      return formatDate(value)
    case 'text':
      return value
  }
}
