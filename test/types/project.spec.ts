import { describe, expect, it } from 'vitest'
import { ProjectOrder, ProjectValues, sortedProjects, type Project } from '@/types/project'

function project(id: number, sortOrder: number): Project {
  return { id, name: `#${id}`, description: null, sortOrder, createdAt: '', updatedAt: '' }
}

describe('ProjectValues.from', () => {
  it('can only be created through from() (checked by the type check)', () => {
    // @ts-expect-error a plain object with the same fields is not a ProjectValues
    const plain: ProjectValues = { name: 'x', description: null }
    expect(plain).not.toBeInstanceOf(ProjectValues)
  })

  it('trims the input and stores an empty description as null', () => {
    expect({ ...ProjectValues.from({ name: ' House ', description: ' Renovate ' }) }).toEqual({
      name: 'House',
      description: 'Renovate',
    })
    expect(ProjectValues.from({ name: 'Car', description: '  ' }).description).toBeNull()
    expect(ProjectValues.from({ name: 'Car' }).description).toBeNull()
  })

  it('needs a name', () => {
    expect(() => ProjectValues.from({ name: '   ' })).toThrow('A project needs a name.')
  })
})

describe('ProjectOrder.from', () => {
  it('keeps a copy of the ids in order', () => {
    const ids = [3, 1]
    const order = ProjectOrder.from(ids)
    ids.push(4)
    expect(order.ids).toEqual([3, 1])
  })

  it.each([[[1, 1]], [[0]], [[1.5]]])('rejects %j', (ids) => {
    expect(() => ProjectOrder.from(ids)).toThrow('Invalid order of the projects.')
  })
})

describe('sortedProjects', () => {
  it('sorts by position, then id, without changing the list', () => {
    const projects = [project(1, 2), project(3, 1), project(2, 1)]
    expect(sortedProjects(projects).map(({ id }) => id)).toEqual([2, 3, 1])
    expect(projects.map(({ id }) => id)).toEqual([1, 3, 2])
  })
})
