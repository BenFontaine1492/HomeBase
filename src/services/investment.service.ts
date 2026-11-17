import * as investmentRepository from '@/repositories/investment.repository'
import { InvestmentValues, type Investment, type InvestmentInput } from '@/types/investment'

export function listInvestments(): Promise<Investment[]> {
  return investmentRepository.findAll()
}

/** Adds an investment at the end of the priority list and returns its id. */
export async function createInvestment(input: InvestmentInput): Promise<number> {
  return investmentRepository.insert(InvestmentValues.from(input))
}

/** Updates the editable fields of an investment. Its position in the list is kept. */
export async function updateInvestment(id: number, input: InvestmentInput): Promise<void> {
  if (!(await investmentRepository.update(id, InvestmentValues.from(input)))) {
    throw new Error('This investment no longer exists.')
  }
}

/** Permanently deletes an investment. Remaining items keep their relative order. */
export async function deleteInvestment(id: number): Promise<void> {
  if (!(await investmentRepository.remove(id))) {
    throw new Error('This investment no longer exists.')
  }
}
