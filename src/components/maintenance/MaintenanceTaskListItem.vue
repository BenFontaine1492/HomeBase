<script setup lang="ts">
import { computed } from 'vue'
import { t } from '@/i18n'
import {
  MAINTENANCE_STATUS_COLORS,
  maintenanceStatusLabel,
  type MaintenanceSchedule,
} from '@/types/maintenance-schedule'
import { intervalLabel, type MaintenanceTask } from '@/types/maintenance-task'
import { formatDate } from '@/utils/date'

const props = defineProps<{
  task: MaintenanceTask
  schedule: MaintenanceSchedule
}>()

defineEmits<{
  done: [task: MaintenanceTask]
  edit: [task: MaintenanceTask]
  delete: [task: MaintenanceTask]
}>()

const details = computed<string>(() => {
  const { lastDone } = props.schedule
  const done = lastDone
    ? t('maintenance.task.lastDone', { date: formatDate(lastDone) })
    : t('maintenance.task.notDoneYet')
  return `${intervalLabel(props.task)} · ${done}`
})

/** "Due 4 Mar 2027 (in 12 days)", "Overdue since …", or why there is no date. */
const dueText = computed<string>(() => {
  const { status, dueDate, daysUntilDue } = props.schedule
  if (status === 'paused') return maintenanceStatusLabel('paused')
  if (dueDate === null || daysUntilDue === null) return t('maintenance.task.noDate')
  if (daysUntilDue < 0) return t('maintenance.task.overdueSince', { date: formatDate(dueDate), count: -daysUntilDue })
  if (daysUntilDue === 0) return t('maintenance.dueToday')
  return t('maintenance.task.dueOn', { date: formatDate(dueDate), count: daysUntilDue })
})
</script>

<template>
  <div class="task-item">
    <div class="task-item__content">
      <div class="task-item__title">
        {{ task.name }}
        <v-chip :color="MAINTENANCE_STATUS_COLORS[schedule.status]" size="x-small" variant="tonal" class="ml-2">
          {{ maintenanceStatusLabel(schedule.status) }}
        </v-chip>
      </div>
      <div class="task-item__details">{{ details }}</div>
      <div class="task-item__due" :class="`task-item__due--${schedule.status}`">{{ dueText }}</div>
    </div>
    <v-btn
      v-if="task.active"
      variant="tonal"
      color="primary"
      size="small"
      prepend-icon="mdi-check"
      v-bind="{ onClick: () => $emit('done', task) }"
    >
      {{ t('maintenance.markDone') }}
    </v-btn>
    <v-menu location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="{ ...menuProps, 'aria-label': t('common.actionsFor', { name: task.name }) }"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          density="comfortable"
        />
      </template>
      <v-list density="compact" min-width="160" rounded="lg">
        <v-list-item prepend-icon="mdi-pencil-outline" :title="t('common.edit')" @click="$emit('edit', task)" />
        <v-list-item
          prepend-icon="mdi-trash-can-outline"
          :title="t('common.delete')"
          base-color="error"
          @click="$emit('delete', task)"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
}

.task-item__content {
  flex: 1;
  min-width: 0;
}

.task-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.task-item__details,
.task-item__due {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.task-item__due--overdue {
  color: rgb(var(--v-theme-error));
}

.task-item__due--due-soon {
  color: rgb(var(--v-theme-warning));
}
</style>
