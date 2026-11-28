import { t } from '@/i18n'
import * as repository from '@/repositories/cost.repository'
import { CostValues, type Cost, type CostInput } from '@/types/cost'
import { CostDetailsValues, type CostDetailsInput } from '@/types/cost-details'
import { rethrowWithMessage } from './service-errors'

/*
 * Costs of the household. The category only groups them (e.g. for the export to a
 * tax advisor); HomeBase applies no tax rules.
 */

function messages(): { missingReference: string } {
  return { missingReference: t('errors.gone.costReference') }
}

export function listCosts(): Promise<Cost[]> {
  return repository.findAll()
}

export async function createCost(input: CostInput): Promise<number> {
  return repository.insert(CostValues.from(input)).catch(rethrowWithMessage(messages()))
}

export async function updateCost(id: number, input: CostInput): Promise<void> {
  const found = await repository.update(id, CostValues.from(input)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.cost'))
}

/** Updates the details of a maintenance record's cost (the record owns its date, amount and payee). */
export async function updateCostDetails(id: number, input: CostDetailsInput): Promise<void> {
  const found = await repository.updateDetails(id, CostDetailsValues.from(input))
  if (!found) throw new Error(t('errors.gone.cost'))
}

/** Deletes a cost and its receipts. */
export async function deleteCost(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.cost'))
}
