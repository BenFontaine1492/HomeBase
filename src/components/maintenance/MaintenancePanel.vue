<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MaintenanceRecordFormDialog from './MaintenanceRecordFormDialog.vue'
import MaintenanceRecordListItem from './MaintenanceRecordListItem.vue'
import MaintenanceTaskFormDialog from './MaintenanceTaskFormDialog.vue'
import MaintenanceTaskListItem from './MaintenanceTaskListItem.vue'
import ReceiptsDialog from './ReceiptsDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAttachments } from '@/composables/useAttachments'
import { useMaintenance } from '@/composables/useMaintenance'
import { t } from '@/i18n'
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
  <div class="hb-sections">
    <v-alert v-if="maintenance.error.value" type="error" density="compact">
      {{ t('maintenance.loadError', { error: maintenance.error.value }) }}
    </v-alert>

    <ListSection
      :title="t('maintenance.panel.tasksTitle')"
      :count="tasks.length"
      :subtitle="t('maintenance.panel.tasksSubtitle')"
    >
      <template #actions>
        <v-btn size="small" prepend-icon="mdi-plus" v-bind="{ onClick: () => openTaskForm(null) }">
          {{ t('maintenance.panel.addTask') }}
        </v-btn>
      </template>
      <v-card v-if="tasks.length === 0">
        <EmptyState
          icon="mdi-wrench-clock"
          :title="t('maintenance.panel.noTasksTitle')"
          :text="t('maintenance.panel.noTasksText')"
        />
      </v-card>
      <MaintenanceTaskListItem
        v-for="{ task, schedule } in tasks"
        :key="task.id"
        :task="task"
        :schedule="schedule"
        @done="openRecordForm(null, $event)"
        @edit="openTaskForm"
        @delete="confirmDeleteTask"
      />
    </ListSection>

    <ListSection
      :title="t('maintenance.panel.historyTitle')"
      :count="records.length"
      :subtitle="t('maintenance.panel.historySubtitle')"
    >
      <template #actions>
        <span v-if="totalCost > 0" class="hb-caption text-medium-emphasis hb-numeric">
          {{ t('maintenance.panel.totalCost', { amount: formatCents(totalCost) }) }}
        </span>
        <v-btn size="small" prepend-icon="mdi-plus" v-bind="{ onClick: () => openRecordForm(null) }">
          {{ t('maintenance.panel.addEntry') }}
        </v-btn>
      </template>
      <v-card v-if="records.length === 0">
        <EmptyState
          icon="mdi-history"
          :title="t('maintenance.panel.noRecordsTitle')"
          :text="t('maintenance.panel.noRecordsText')"
        />
      </v-card>
      <MaintenanceRecordListItem
        v-for="record in records"
        :key="record.id"
        :record="record"
        :task-name="maintenance.findTask(record.taskId)?.name ?? null"
        :receipt-count="receiptCount(record)"
        @receipts="openReceipts"
        @edit="openRecordForm"
        @delete="confirmDeleteRecord"
      />
    </ListSection>

    <MaintenanceTaskFormDialog v-model="isTaskFormOpen" :object-id="object.id" :task="taskToEdit" />
    <MaintenanceRecordFormDialog
      v-model="isRecordFormOpen"
      :object-id="object.id"
      :record="recordToEdit"
      :task="taskDone"
    />
    <ReceiptsDialog v-model="isReceiptsOpen" :record="receiptsRecord" />
    <ConfirmDialog v-model="isDeleteTaskOpen" :title="t('maintenance.deleteTask.title')" :action="deleteTask">
      {{ t('maintenance.deleteTask.text', { name: taskToDelete?.name ?? '' }) }}
      <template v-if="recordsOfTaskToDelete > 0">
        {{ t('maintenance.deleteTask.recordsStay', { count: recordsOfTaskToDelete }) }}
      </template>
      {{ t('maintenance.deleteTask.pauseHint') }}
    </ConfirmDialog>
    <ConfirmDialog v-model="isDeleteRecordOpen" :title="t('maintenance.deleteRecord.title')" :action="deleteRecord">
      {{ t('maintenance.deleteRecord.text') }}
    </ConfirmDialog>
  </div>
</template>
