import { t } from '@/i18n'
import * as repository from '@/repositories/income.repository'
import { IncomeValues, type Income, type IncomeInput } from '@/types/income'
import { rethrowWithMessage } from './service-errors'

/*
 * Income of the household. The category only groups it for the export to a tax
 * advisor; HomeBase applies no tax rules.
 */

function messages(): { missingReference: string } {
  return { missingReference: t('errors.gone.incomeReference') }
}

export function listIncome(): Promise<Income[]> {
  return repository.findAll()
}

export async function createIncome(input: IncomeInput): Promise<number> {
  return repository.insert(IncomeValues.from(input)).catch(rethrowWithMessage(messages()))
}

export async function updateIncome(id: number, input: IncomeInput): Promise<void> {
  const found = await repository.update(id, IncomeValues.from(input)).catch(rethrowWithMessage(messages()))
  if (!found) throw new Error(t('errors.gone.income'))
}

/** Deletes an income entry and its documents. */
export async function deleteIncome(id: number): Promise<void> {
  if (!(await repository.remove(id))) throw new Error(t('errors.gone.income'))
}
