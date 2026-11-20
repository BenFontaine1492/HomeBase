import { ref } from 'vue'

/** Messages waiting to be shown. App.vue shows them with one v-snackbar-queue, which takes them off this list. */
const queue = ref<string[]>([])

/**
 * Short confirmations after an action, e.g. "Saved" or "Backup saved to …", shown as toasts
 * (bottom right, a few seconds). Errors are no toasts: they stay next to their cause.
 */
export function useNotifications() {
  function notify(text: string): void {
    // The same message twice in a row (e.g. two quick changes in Settings) is shown once.
    if (queue.value.at(-1) !== text) queue.value = [...queue.value, text]
  }

  return { queue, notify }
}
