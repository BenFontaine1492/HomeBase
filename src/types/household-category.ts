import { t } from '@/i18n'
import type { Messages } from '@/i18n/messages/en'
import { normaliseText } from '@/utils/text'

/** A user-defined inventory category such as "Heating" or "Energy". */
export interface HouseholdCategory {
  id: number
  name: string
  /** MDI icon name, one of `CATEGORY_ICONS`. */
  icon: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a category, used for both creating and updating. */
export interface HouseholdCategoryInput {
  name: string
  icon: string
  description?: string | null
}

/** Name of a category icon's label in the messages (`categoryIcons.<key>`). */
export type CategoryIconKey = keyof Messages['categoryIcons']

export interface CategoryIconOption {
  icon: string
  key: CategoryIconKey
}

/** Curated icons offered in the category form. */
export const CATEGORY_ICONS: readonly CategoryIconOption[] = [
  { icon: 'mdi-radiator', key: 'heating' },
  { icon: 'mdi-fire', key: 'fireStove' },
  { icon: 'mdi-water-boiler', key: 'boiler' },
  { icon: 'mdi-air-conditioner', key: 'airConditioning' },
  { icon: 'mdi-solar-power-variant', key: 'solar' },
  { icon: 'mdi-lightning-bolt-outline', key: 'electricity' },
  { icon: 'mdi-lightbulb-outline', key: 'lighting' },
  { icon: 'mdi-water-pump', key: 'water' },
  { icon: 'mdi-shower-head', key: 'bathroom' },
  { icon: 'mdi-washing-machine', key: 'laundry' },
  { icon: 'mdi-fridge-outline', key: 'kitchenAppliances' },
  { icon: 'mdi-silverware-fork-knife', key: 'kitchen' },
  { icon: 'mdi-sofa-outline', key: 'furniture' },
  { icon: 'mdi-bed-outline', key: 'bedroom' },
  { icon: 'mdi-television', key: 'entertainment' },
  { icon: 'mdi-laptop', key: 'computers' },
  { icon: 'mdi-router-wireless', key: 'network' },
  { icon: 'mdi-shield-home-outline', key: 'security' },
  { icon: 'mdi-flower-outline', key: 'garden' },
  { icon: 'mdi-car-outline', key: 'car' },
  { icon: 'mdi-bicycle', key: 'bicycle' },
  { icon: 'mdi-tools', key: 'tools' },
  { icon: 'mdi-hammer-wrench', key: 'workshop' },
  { icon: 'mdi-home-city-outline', key: 'realEstate' },
  { icon: 'mdi-toolbox-outline', key: 'miscellaneous' },
]

export const DEFAULT_CATEGORY_ICON = 'mdi-toolbox-outline'

/** The label of a category icon (tooltip in the category form). */
export function categoryIconLabel(option: CategoryIconOption): string {
  return t(`categoryIcons.${option.key}`)
}

/** Label and icon used for objects without a category. */
export function uncategorizedLabel(): string {
  return t('inventory.uncategorized')
}
export const UNCATEGORIZED_ICON = 'mdi-tag-off-outline'

export interface DeleteCategoryOptions {
  /** true: delete the assigned objects too. false: keep them without a category. */
  deleteObjects: boolean
}

/**
 * The editable fields of a category, validated and normalised (value object).
 * Only `HouseholdCategoryValues.from()` can create one.
 */
export class HouseholdCategoryValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'HouseholdCategoryValues'

  private constructor(
    readonly name: string,
    /** One of `CATEGORY_ICONS`. */
    readonly icon: string,
    readonly description: string | null,
  ) {}

  /** Checks the form input and trims it. Throws an error with a readable message. */
  static from(input: HouseholdCategoryInput): HouseholdCategoryValues {
    const name = input.name.trim()
    if (name.length === 0) {
      throw new Error(t('errors.category.nameRequired'))
    }
    if (!CATEGORY_ICONS.some((option) => option.icon === input.icon)) {
      throw new Error(t('errors.category.unknownIcon', { icon: input.icon }))
    }
    return new HouseholdCategoryValues(name, input.icon, normaliseText(input.description))
  }
}
