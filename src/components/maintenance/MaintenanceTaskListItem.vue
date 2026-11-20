<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
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

const emit = defineEmits<{
  done: [task: MaintenanceTask]
  edit: [task: MaintenanceTask]
  delete: [task: MaintenanceTask]
}>()

/** "Yearly", "Last done 12 Oct 2025". */
const details = computed<string[]>(() => {
  const { lastDone } = props.schedule
  return [
    intervalLabel(props.task),
    lastDone ? t('maintenance.task.lastDone', { date: formatDate(lastDone) }) : t('maintenance.task.notDoneYet'),
  ]
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

/** Overdue and due-soon dates in their status colour. */
const dueClass = computed<string | undefined>(() => {
  const { status } = props.schedule
  return status === 'overdue' || status === 'due-soon' ? `text-${MAINTENANCE_STATUS_COLORS[status]}` : undefined
})

const actions = computed(() => [
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.task) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.task),
  },
])
</script>

<template>
  <ListRow>
    <div class="task-item__title">
      <span class="hb-body">{{ task.name }}</span>
      <StatusBadge :color="MAINTENANCE_STATUS_COLORS[schedule.status]">
        {{ maintenanceStatusLabel(schedule.status) }}
      </StatusBadge>
    </div>
    <MetaList :items="details">
      <span :class="dueClass">{{ dueText }}</span>
    </MetaList>

    <template #append>
      <v-btn v-if="task.active" size="small" prepend-icon="mdi-check" v-bind="{ onClick: () => emit('done', task) }">
        {{ t('maintenance.markDone') }}
      </v-btn>
      <ActionsMenu :label="t('common.actionsFor', { name: task.name })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.task-item__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
</style>
