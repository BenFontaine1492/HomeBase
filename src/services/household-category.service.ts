import { t } from '@/i18n'
import * as categoryRepository from '@/repositories/household-category.repository'
import { DuplicateValueError } from '@/repositories/repository-errors'
import {
  HouseholdCategoryValues,
  type DeleteCategoryOptions,
  type HouseholdCategory,
  type HouseholdCategoryInput,
} from '@/types/household-category'

/** Category names are unique (ignoring case); say so instead of showing the SQLite message. */
function rethrowDuplicateName(error: unknown): never {
  if (error instanceof DuplicateValueError) throw new Error(t('errors.category.duplicate'))
  throw error
}

export function listCategories(): Promise<HouseholdCategory[]> {
  return categoryRepository.findAll()
}

/** Creates a category and returns its id. */
export async function createCategory(input: HouseholdCategoryInput): Promise<number> {
  return categoryRepository.insert(HouseholdCategoryValues.from(input)).catch(rethrowDuplicateName)
}

export async function updateCategory(id: number, input: HouseholdCategoryInput): Promise<void> {
  const values = HouseholdCategoryValues.from(input)
  if (!(await categoryRepository.update(id, values).catch(rethrowDuplicateName))) {
    throw new Error(t('errors.gone.category'))
  }
}

/**
 * Deletes a category. Its objects are either deleted as well or kept as
 * "No category assigned" (`options.deleteObjects`). All or nothing.
 */
export async function deleteCategory(id: number, options: DeleteCategoryOptions): Promise<void> {
  if (!(await categoryRepository.remove(id, options))) {
    throw new Error(t('errors.gone.category'))
  }
}
