<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MaintenanceRecordFormDialog from './MaintenanceRecordFormDialog.vue'
import MaintenanceRecordListItem from './MaintenanceRecordListItem.vue'
import MaintenanceTaskFormDialog from './MaintenanceTaskFormDialog.vue'
import MaintenanceTaskListItem from './MaintenanceTaskListItem.vue'
import ReceiptsDialog from './ReceiptsDialog.vue'
import ConfirmDeleteDialog from '@/components/common/ConfirmDeleteDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useMaintenance } from '@/composables/useMaintenance'
import type { HouseholdObject } from '@/types/household-object'
import type { MaintenanceRecord } from '@/types/maintenance-record'
import { compareByUrgency } from '@/types/maintenance-schedule'
import type { MaintenanceTask } from '@/types/maintenance-task'
import { formatCents } from '@/utils/currency'

/** The Maintenance tab of an object page: recurring tasks and the history. */
const props = defineProps<{
  object: HouseholdObject
}>()

const maintenance = useMaintenance()
const attachments = useAttachments()

/** Tasks with their schedules, most urgent first. */
const tasks = computed(() =>
  maintenance
    .tasksOf(props.object.id)
    .map((task) => ({ task, schedule: maintenance.scheduleOf(task, props.object) }))
    // A fresh array from map(); toSorted() needs lib ES2023 (tsconfig has ES2022).
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((a, b) => compareByUrgency(a.schedule, b.schedule)),
)
const records = computed(() => maintenance.recordsOf(props.object.id))
const totalCost = computed<number>(() => maintenance.costOf(props.object.id))

function receiptCount(record: MaintenanceRecord): number {
  return attachments.attachmentsOf({ kind: 'maintenance-record', id: record.id }).length
}

// Dialogs: which one is open and what it works on.
const isTaskFormOpen = ref(false)
const taskToEdit = ref<MaintenanceTask | null>(null)
const isRecordFormOpen = ref(false)
const recordToEdit = ref<MaintenanceRecord | null>(null)
const taskDone = ref<MaintenanceTask | null>(null)
const isReceiptsOpen = ref(false)
const receiptsRecord = ref<MaintenanceRecord | null>(null)
const isDeleteTaskOpen = ref(false)
const taskToDelete = ref<MaintenanceTask | null>(null)
const isDeleteRecordOpen = ref(false)
const recordToDelete = ref<MaintenanceRecord | null>(null)

const recordsOfTaskToDelete = computed<number>(
  () => records.value.filter((record) => record.taskId === taskToDelete.value?.id).length,
)

function openTaskForm(task: MaintenanceTask | null): void {
  taskToEdit.value = task
  isTaskFormOpen.value = true
}

/** "Mark as done" (with a task) or a new / edited history entry. */
function openRecordForm(record: MaintenanceRecord | null, task: MaintenanceTask | null = null): void {
  recordToEdit.value = record
  taskDone.value = task
  isRecordFormOpen.value = true
}

function openReceipts(record: MaintenanceRecord): void {
  receiptsRecord.value = record
  isReceiptsOpen.value = true
}

function confirmDeleteTask(task: MaintenanceTask): void {
  taskToDelete.value = task
  isDeleteTaskOpen.value = true
}

function confirmDeleteRecord(record: MaintenanceRecord): void {
  recordToDelete.value = record
  isDeleteRecordOpen.value = true
}

async function deleteTask(): Promise<void> {
  if (taskToDelete.value) await maintenance.deleteTask(taskToDelete.value.id)
}

async function deleteRecord(): Promise<void> {
  if (recordToDelete.value) await maintenance.deleteRecord(recordToDelete.value.id)
}

onMounted(() => {
  void Promise.all([maintenance.ensureLoaded(), attachments.ensureLoaded()])
})
</script>

<template>
  <div>
    <v-alert v-if="maintenance.error.value" type="error" density="compact" class="ma-6">
      Could not load the maintenance data: {{ maintenance.error.value }}
    </v-alert>

    <div class="maintenance__header">
      <div class="maintenance__icon">
        <v-icon icon="mdi-calendar-sync" size="20" color="primary" />
      </div>
      <div class="maintenance__heading">
        <div class="maintenance__title">
          Recurring tasks
          <span class="maintenance__count">{{ tasks.length }}</span>
        </div>
        <div class="maintenance__subtitle">What has to be done regularly, most urgent first</div>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" v-bind="{ onClick: () => openTaskForm(null) }">
        Add task
      </v-btn>
    </div>
    <EmptyState
      v-if="tasks.length === 0"
      icon="mdi-wrench-clock"
      title="No maintenance tasks"
      text="Add what has to be done regularly, e.g. a yearly service. HomeBase then shows when it is due."
    />
    <template v-for="({ task, schedule }, index) in tasks" :key="task.id">
      <v-divider v-if="index > 0" />
      <MaintenanceTaskListItem
        :task="task"
        :schedule="schedule"
        @done="openRecordForm(null, $event)"
        @edit="openTaskForm"
        @delete="confirmDeleteTask"
      />
    </template>

    <div class="maintenance__header maintenance__header--next">
      <div class="maintenance__icon">
        <v-icon icon="mdi-history" size="20" color="primary" />
      </div>
      <div class="maintenance__heading">
        <div class="maintenance__title">
          History
          <span class="maintenance__count">{{ records.length }}</span>
        </div>
        <div class="maintenance__subtitle">
          What was done, newest first<template v-if="totalCost > 0">
            · total cost {{ formatCents(totalCost) }}</template
          >
        </div>
      </div>
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" v-bind="{ onClick: () => openRecordForm(null) }">
        Add entry
      </v-btn>
    </div>
    <EmptyState
      v-if="records.length === 0"
      icon="mdi-history"
      title="No maintenance recorded"
      text="Use “Mark as done” on a task, or add an entry for other work such as a repair."
    />
    <template v-for="(record, index) in records" :key="record.id">
      <v-divider v-if="index > 0" />
      <MaintenanceRecordListItem
        :record="record"
        :task-name="maintenance.findTask(record.taskId)?.name ?? null"
        :receipt-count="receiptCount(record)"
        @receipts="openReceipts"
        @edit="openRecordForm"
        @delete="confirmDeleteRecord"
      />
    </template>

    <MaintenanceTaskFormDialog v-model="isTaskFormOpen" :object-id="object.id" :task="taskToEdit" />
    <MaintenanceRecordFormDialog
      v-model="isRecordFormOpen"
      :object-id="object.id"
      :record="recordToEdit"
      :task="taskDone"
    />
    <ReceiptsDialog v-model="isReceiptsOpen" :record="receiptsRecord" />
    <ConfirmDeleteDialog v-model="isDeleteTaskOpen" title="Delete maintenance task?" :action="deleteTask">
      <strong>{{ taskToDelete?.name }}</strong> will be removed.
      <template v-if="recordsOfTaskToDelete > 0">
        Its {{ recordsOfTaskToDelete }} history {{ recordsOfTaskToDelete === 1 ? 'entry stays' : 'entries stay' }}, as
        “Other work”.
      </template>
      To stop it for a while instead, edit it and switch it off.
    </ConfirmDeleteDialog>
    <ConfirmDeleteDialog v-model="isDeleteRecordOpen" title="Delete history entry?" :action="deleteRecord">
      This entry and its receipts will be permanently removed. This cannot be undone.
    </ConfirmDeleteDialog>
  </div>
</template>

<style scoped>
/* Section headers: a tinted band with a primary accent, so they stand apart from the rows below. */
.maintenance__header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 24px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-left: 4px solid rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.06);
}

/* Clear gap between the task list and the history. */
.maintenance__header--next {
  margin-top: 32px;
}

.maintenance__icon {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(var(--v-theme-primary), 0.12);
}

.maintenance__heading {
  flex: 1;
  min-width: 0;
}

.maintenance__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.0625rem;
  font-weight: 700;
}

.maintenance__count {
  padding: 0 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.5rem;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.12);
}

.maintenance__subtitle {
  margin-top: 2px;
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
