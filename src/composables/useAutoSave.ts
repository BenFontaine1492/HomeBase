import { ref } from 'vue'
import { describeError } from '@/utils/error'

/**
 * Saves after every change, as in Windows Settings: one save at a time and in order (a change
 * during a save is saved right after it), each reading the form as it is then. Keeps the error
 * of the last save; `onSaved` runs after each successful one (e.g. a "Saved" toast).
 */
export function useAutoSave(task: () => Promise<void>, onSaved: () => void) {
  const error = ref<string | null>(null)
  let last: Promise<void> = Promise.resolve()

  function save(): Promise<void> {
    last = last.then(async () => {
      try {
        await task()
        error.value = null
        onSaved()
      } catch (cause) {
        console.error(cause)
        error.value = describeError(cause)
      }
    })
    return last
  }

  return { error, save }
}
