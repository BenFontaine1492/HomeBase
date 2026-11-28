import { t } from '@/i18n'
import * as projectRepository from '@/repositories/project.repository'
import { ProjectOrder, ProjectValues, type Project, type ProjectInput } from '@/types/project'
import { rethrowWithMessage } from './service-errors'

/** Project names are unique (ignoring case); say so instead of showing the SQLite message. */
function rethrowDuplicateName(error: unknown): never {
  return rethrowWithMessage({ duplicateValue: t('errors.project.duplicate') })(error)
}

export function listProjects(): Promise<Project[]> {
  return projectRepository.findAll()
}

/** Adds a project at the end of the list and returns its id. */
export async function createProject(input: ProjectInput): Promise<number> {
  return projectRepository.insert(ProjectValues.from(input)).catch(rethrowDuplicateName)
}

/** Updates name and description of a project. Its position in the list is kept. */
export async function updateProject(id: number, input: ProjectInput): Promise<void> {
  const values = ProjectValues.from(input)
  if (!(await projectRepository.update(id, values).catch(rethrowDuplicateName))) {
    throw new Error(t('errors.gone.project'))
  }
}

/** Saves the order of the projects (ids, first = funded first). */
export async function reorderProjects(ids: readonly number[]): Promise<void> {
  await projectRepository.reorder(ProjectOrder.from(ids))
}

/** Permanently deletes a project with its investments. */
export async function deleteProject(id: number): Promise<void> {
  if (!(await projectRepository.remove(id))) {
    throw new Error(t('errors.gone.project'))
  }
}
