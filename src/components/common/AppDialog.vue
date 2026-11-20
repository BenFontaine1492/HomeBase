<script setup lang="ts">
import { t } from '@/i18n'

/**
 * The frame of every dialog, like a Windows content dialog: title (and subtitle), a body
 * that scrolls, and a footer band with the buttons in the `actions` slot (main action
 * first). `busy` keeps it open (no Escape, no click outside) while something is saved.
 * A form in the body is submitted by a button with `form: <its id>` in the footer.
 * `requiredHint`: the form has required fields (labels ending in "*"); explains the mark.
 */
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'small' | 'medium' | 'large'
    busy?: boolean
    requiredHint?: boolean
  }>(),
  { size: 'medium' },
)

const open = defineModel<boolean>({ required: true })

const WIDTHS: Readonly<Record<'small' | 'medium' | 'large', number>> = { small: 440, medium: 560, large: 720 }
</script>

<template>
  <v-dialog v-model="open" :max-width="WIDTHS[size]" :persistent="busy" scrollable>
    <v-card elevation="4">
      <div class="app-dialog__header">
        <h2 class="hb-subtitle">{{ title }}</h2>
        <p v-if="subtitle" class="app-dialog__subtitle text-medium-emphasis">{{ subtitle }}</p>
        <p v-if="requiredHint" class="hb-caption text-medium-emphasis mt-2">{{ t('common.requiredHint') }}</p>
      </div>
      <v-card-text class="app-dialog__body hb-body">
        <slot />
      </v-card-text>
      <div v-if="$slots.actions" class="app-dialog__footer">
        <slot name="actions" />
      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.app-dialog__header {
  padding: 24px 24px 16px;
}

.app-dialog__subtitle {
  margin-top: 4px;
  overflow-wrap: anywhere;
}

.app-dialog__body {
  padding: 4px 24px 24px;
}

/* Equal-width buttons, as in Windows dialogs. */
.app-dialog__footer {
  display: grid;
  grid-auto-columns: 1fr;
  grid-auto-flow: column;
  gap: 8px;
  padding: 24px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-background));
}
</style>
