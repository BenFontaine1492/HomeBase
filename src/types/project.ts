import { t } from '@/i18n'
import { normaliseText } from '@/utils/text'

/**
 * A project groups the investments it needs, e.g. "Renovate the house" with
 * "Repaint the walls" and "New windows". The order of the projects is the order
 * in which the savings roadmap funds them.
 */
export interface Project {
  id: number
  name: string
  description: string | null
  /** Position in the list of projects (= funding order). */
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** User-editable fields of a project, used for both creating and updating. */
export interface ProjectInput {
  name: string
  description?: string | null
}

/** The editable fields of a project, validated and normalised (value object). Only `from()` can create one. */
export class ProjectValues {
  /** Type-only brand: makes the class nominal, so a plain object with the same fields is rejected. */
  declare private readonly brand: 'ProjectValues'

  private constructor(
    readonly name: string,
    readonly description: string | null,
  ) {}

  /** Checks the form input and trims it. Throws an error with a readable message. */
  static from(input: ProjectInput): ProjectValues {
    const name = input.name.trim()
    if (name.length === 0) throw new Error(t('errors.project.nameRequired'))
    return new ProjectValues(name, normaliseText(input.description))
  }
}

/** The new order of the projects (value object): their ids, first = funded first. */
export class ProjectOrder {
  declare private readonly brand: 'ProjectOrder'

  private constructor(readonly ids: readonly number[]) {}

  static from(ids: readonly number[]): ProjectOrder {
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) throw new Error(t('errors.project.invalidOrder'))
    if (new Set(ids).size !== ids.length) throw new Error(t('errors.project.invalidOrder'))
    return new ProjectOrder([...ids])
  }
}

/** Projects in their order (sort order, then id). */
export function sortedProjects(projects: readonly Project[]): Project[] {
  // A fresh array from the spread; toSorted() needs lib ES2023 (tsconfig has ES2022).
  // oxlint-disable-next-line unicorn/no-array-sort
  return [...projects].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}
