import { t } from '@/i18n'
import * as repository from '@/repositories/tax-category.repository'
import {
  DEFAULT_TAX_CATEGORIES,
  TaxCategoryValues,
  type TaxCategory,
  type TaxCategoryInput,
} from '@/types/tax-category'
import { rethrowWithMessage } from './service-errors'

function messages(): { duplicateValue: string } {
  return { duplicateValue: t('errors.taxCategory.duplicate') }
}

export function listTaxCategories(): Promise<TaxCategory[]> {
  return repository.findAll()
}

export async function createTaxCategory(input: TaxCategoryInput): Promise<number> {
  return repository.insert(TaxCategoryValues.from(input)).catch(rethrowWithMessage(messages()))
}

export async function updateTaxCategory(id: number, input: TaxCategoryInput): Promise<void> {
  const found = await repository.update(id, TaxCategoryValues.from(input)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.taxCategory'))
}

/** Deletes a category. Its costs stay, without a tax category. */
export async function deleteTaxCategory(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.taxCategory'))
}

/** Adds the default categories (names already in the list are skipped). */
export async function addDefaultTaxCategories(): Promise<void> {
  await repository.insertAll(DEFAULT_TAX_CATEGORIES.map((input) => TaxCategoryValues.from(input)))
}
