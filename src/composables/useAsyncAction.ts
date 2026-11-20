import { ref, type Ref } from 'vue'
import { describeError } from '@/utils/error'

/**
 * One async action at a time, with its error: saving a dialog, or one of several actions
 * of a card ("backup" or "restore"; `current` names the one that runs, for its spinner).
 * `run` ignores calls while an action runs. Local state of one component, not shared.
 */
export function useAsyncAction<Action extends string = never>() {
  const isRunning = ref(false)
  const current: Ref<Action | null> = ref(null)
  const error = ref<string | null>(null)

  async function run(task: () => Promise<void>, action: Action | null = null): Promise<void> {
    if (isRunning.value) return
    isRunning.value = true
    current.value = action
    error.value = null
    try {
      await task()
    } catch (cause) {
      console.error(cause)
      error.value = describeError(cause)
    } finally {
      isRunning.value = false
      current.value = null
    }
  }

  /** True while another action than `action` runs. */
  function isDisabled(action: Action): boolean {
    return isRunning.value && current.value !== action
  }

  return { isRunning, current, error, run, isDisabled }
}
