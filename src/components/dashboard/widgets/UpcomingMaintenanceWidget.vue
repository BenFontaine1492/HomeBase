<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '@/components/common/EmptyState.vue'
import MetaList from '@/components/common/MetaList.vue'
import MaintenanceRecordFormDialog from '@/components/maintenance/MaintenanceRecordFormDialog.vue'
import { useHouseholdCategories } from '@/composables/useHouseholdCategories'
import { useHouseholdObjects } from '@/composables/useHouseholdObjects'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
import type { WidgetSettings, WidgetSize } from '@/types/dashboard'
import { resolveFilter, upcomingMaintenance, type UpcomingTask } from '@/types/dashboard-statistics'
import { MAINTENANCE_STATUS_COLORS } from '@/types/maintenance-schedule'
import type { MaintenanceTask } from '@/types/maintenance-task'
import { formatDate } from '@/utils/date'

/** Overdue and due-soon maintenance tasks, most urgent first, with "Mark as done". */
const props = defineProps<{
  settings: WidgetSettings
  size: WidgetSize
}>()

const { objects, ensureLoaded: loadObjects } = useHouseholdObjects()
const { categories, ensureLoaded: loadCategories } = useHouseholdCategories()
const { tasks, scheduleOf, ensureLoaded: loadMaintenance } = useMaintenance()

onMounted(() => {
  void Promise.all([loadObjects(), loadCategories(), loadMaintenance()])
})

const resolved = computed(() => resolveFilter(props.settings, categories.value, objects.value))

const upcoming = computed<UpcomingTask[]>(() => {
  const objectsById = new Map(objects.value.map((object) => [object.id, object]))
  const all = tasks.value.flatMap((task) => {
    const object = objectsById.get(task.objectId)
    return object ? [{ task, object, schedule: scheduleOf(task, object) }] : []
  })
  return upcomingMaintenance(all, resolved.value.filter)
})

const limit = computed<number>(() => (props.size === 'large' ? 10 : 5))
const shown = computed<UpcomingTask[]>(() => upcoming.value.slice(0, limit.value))

function dueText({ schedule }: UpcomingTask): string {
  const days = schedule.daysUntilDue ?? 0
  const date = schedule.dueDate ? formatDate(schedule.dueDate) : ''
  if (days < 0) return t('dashboard.widgets.overdueBy', { count: -days, date })
  if (days === 0) return t('maintenance.dueToday')
  return t('dashboard.widgets.dueIn', { count: days, date })
}

const isRecordFormOpen = ref(false)
const taskDone = ref<MaintenanceTask | null>(null)

function markAsDone(task: MaintenanceTask): void {
  taskDone.value = task
  isRecordFormOpen.value = true
}
</script>

<template>
  <div>
    <p v-if="resolved.stale" class="hb-caption text-medium-emphasis mb-2">{{ t('dashboard.widgets.staleFilter') }}</p>

    <EmptyState
      v-if="upcoming.length === 0"
      compact
      icon="mdi-check-circle-outline"
      :title="t('dashboard.widgets.nothingDueTitle')"
      :text="t('dashboard.widgets.nothingDueText')"
    />

    <v-list v-else density="compact" class="py-0">
      <v-list-item
        v-for="item in shown"
        :key="item.task.id"
        :to="{ name: 'inventory-object', params: { objectId: item.object.id }, query: { tab: 'maintenance' } }"
        :title="item.task.name"
        rounded
        class="px-2"
      >
        <template #prepend>
          <v-icon
            icon="mdi-wrench-clock"
            :color="MAINTENANCE_STATUS_COLORS[item.schedule.status]"
            size="20"
            class="me-n2"
          />
        </template>
        <MetaList :items="[item.object.name]">
          <span :class="`text-${MAINTENANCE_STATUS_COLORS[item.schedule.status]}`">{{ dueText(item) }}</span>
        </MetaList>
        <template #append>
          <v-btn
            icon="mdi-check"
            size="small"
            variant="text"
            color="success"
            v-bind="{
              onClick: (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()
                markAsDone(item.task)
              },
              title: t('maintenance.markDone'),
              'aria-label': t('dashboard.widgets.markTaskDone', { name: item.task.name }),
            }"
          />
        </template>
      </v-list-item>
    </v-list>

    <p v-if="upcoming.length > shown.length" class="hb-caption text-medium-emphasis mt-2">
      {{ t('dashboard.widgets.more', { count: upcoming.length - shown.length }) }}
    </p>

    <MaintenanceRecordFormDialog
      v-if="taskDone"
      v-model="isRecordFormOpen"
      :object-id="taskDone.objectId"
      :task="taskDone"
    />
  </div>
</template>
