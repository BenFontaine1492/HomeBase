import { t } from '@/i18n'
import * as investmentRepository from '@/repositories/investment.repository'
import {
  InvestmentOrder,
  InvestmentValues,
  investmentInputOf,
  type Investment,
  type InvestmentInput,
} from '@/types/investment'
import { rethrowWithMessage } from './service-errors'

/** The project of an investment may have been deleted meanwhile. */
function rethrowProjectGone(error: unknown): never {
  return rethrowWithMessage({ missingReference: t('errors.investment.projectGone') })(error)
}

export function listInvestments(): Promise<Investment[]> {
  return investmentRepository.findAll()
}

/** Adds an investment at the end of the priority list and returns its id. */
export async function createInvestment(input: InvestmentInput): Promise<number> {
  return investmentRepository.insert(InvestmentValues.from(input)).catch(rethrowProjectGone)
}

/** Updates the editable fields of an investment. Its position in the list is kept. */
export async function updateInvestment(id: number, input: InvestmentInput): Promise<void> {
  const values = InvestmentValues.from(input)
  if (!(await investmentRepository.update(id, values).catch(rethrowProjectGone))) {
    throw new Error(t('errors.gone.investment'))
  }
}

/** Marks an investment as bought on `purchasedDate` ('YYYY-MM-DD'). */
export function markPurchased(investment: Investment, purchasedDate: string): Promise<void> {
  return updateInvestment(investment.id, { ...investmentInputOf(investment), status: 'purchased', purchasedDate })
}

/** Moves a purchased investment back to the planned ones. */
export function markPlanned(investment: Investment): Promise<void> {
  return updateInvestment(investment.id, { ...investmentInputOf(investment), status: 'planned', purchasedDate: null })
}

/** Saves the order of the planned investments (ids, most important first). */
export async function reorderInvestments(ids: readonly number[]): Promise<void> {
  await investmentRepository.reorder(InvestmentOrder.from(ids))
}

/** Permanently deletes an investment. Remaining items keep their relative order. */
export async function deleteInvestment(id: number): Promise<void> {
  if (!(await investmentRepository.remove(id))) {
    throw new Error(t('errors.gone.investment'))
  }
}
