import { t } from '@/i18n'
import * as repository from '@/repositories/cost.repository'
import { CostValues, type Cost, type CostInput } from '@/types/cost'
import { CostDetailsValues, type CostDetailsInput } from '@/types/cost-details'
import type { TaxCategory } from '@/types/tax-category'
import { rethrowWithMessage } from './service-errors'

/*
 * Costs of the household. The tax category only groups them for the export to a
 * tax advisor; HomeBase applies no tax rules.
 */

function messages(): { missingReference: string } {
  return { missingReference: t('errors.gone.costReference') }
}

export function listCosts(): Promise<Cost[]> {
  return repository.findAll()
}

/** `category` = the selected tax category (it decides whether the labour share is kept). */
export async function createCost(input: CostInput, category: TaxCategory | undefined): Promise<number> {
  return repository.insert(CostValues.from(input, category)).catch(rethrowWithMessage(messages()))
}

export async function updateCost(id: number, input: CostInput, category: TaxCategory | undefined): Promise<void> {
  const found = await repository.update(id, CostValues.from(input, category)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.cost'))
}

/** Updates the tax details of a maintenance record's cost; `amountCents` is its amount (set by the record). */
export async function updateCostDetails(
  id: number,
  input: CostDetailsInput,
  category: TaxCategory | undefined,
  amountCents: number,
): Promise<void> {
  const found = await repository
    .updateDetails(id, CostDetailsValues.from(input, category, amountCents))
    .catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.cost'))
}

/** Deletes a cost and its receipts. */
export async function deleteCost(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.cost'))
}
