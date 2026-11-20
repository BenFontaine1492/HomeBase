<script setup lang="ts">
import { watch } from 'vue'
import AppDialog from './AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { t } from '@/i18n'

/**
 * "Delete …?" or another confirmation (e.g. restoring a backup). `action` does the work;
 * the dialog shows its progress and error, and closes when it succeeds. The default slot
 * is the text. `tone` colours the confirm button: error (default) or warning.
 */
const props = withDefaults(
  defineProps<{
    title: string
    action: () => Promise<void>
    /** Text of the confirm button; default "Delete". */
    confirmLabel?: string
    tone?: 'error' | 'warning'
  }>(),
  { tone: 'error' },
)

const open = defineModel<boolean>({ required: true })

const { isRunning, error, run } = useAsyncAction()

watch(open, (isOpen) => {
  if (isOpen) error.value = null
})

function confirm(): Promise<void> {
  return run(async () => {
    await props.action()
    open.value = false
  })
}
</script>

<template>
  <AppDialog v-model="open" :title="title" size="small" :busy="isRunning">
    <slot />
    <v-alert v-if="error" type="error" density="compact" class="mt-4">{{ error }}</v-alert>
    <template #actions>
      <v-btn :color="tone" variant="flat" :loading="isRunning" v-bind="{ onClick: confirm }">
        {{ confirmLabel ?? t('common.delete') }}
      </v-btn>
      <v-btn :disabled="isRunning" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
