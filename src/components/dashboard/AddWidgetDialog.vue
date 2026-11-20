<script setup lang="ts">
import { watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useDashboard } from '@/composables/useDashboard'
import { t } from '@/i18n'
import { WIDGET_TYPES, widgetTypeDescription, widgetTypeTitle } from '@/types/dashboard'

/** Picks a widget type and adds it at the end of the dashboard. */
const open = defineModel<boolean>({ required: true })

const { addWidget } = useDashboard()
/** `current` is the widget type being added (its row shows a spinner). */
const { isRunning, current, error, run } = useAsyncAction<string>()

watch(open, (isOpen) => {
  if (isOpen) error.value = null
})

function add(typeId: string): Promise<void> {
  return run(async () => {
    await addWidget(typeId)
    open.value = false
  }, typeId)
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('dashboard.addWidget')"
    :subtitle="t('dashboard.addWidgetHint')"
    :busy="isRunning"
  >
    <v-list class="pa-0">
      <v-list-item
        v-for="type in WIDGET_TYPES"
        :key="type.id"
        :prepend-icon="type.icon"
        :title="widgetTypeTitle(type)"
        :subtitle="widgetTypeDescription(type)"
        :disabled="isRunning"
        rounded
        lines="two"
        @click="add(type.id)"
      >
        <template #append>
          <v-progress-circular v-if="current === type.id" indeterminate size="20" width="2" color="primary" />
          <v-icon v-else icon="mdi-plus" />
        </template>
      </v-list-item>
    </v-list>
    <v-alert v-if="error" type="error" density="compact" class="mt-4">{{ error }}</v-alert>

    <template #actions>
      <v-btn :disabled="isRunning" v-bind="{ onClick: () => (open = false) }">{{ t('common.close') }}</v-btn>
    </template>
  </AppDialog>
</template>
