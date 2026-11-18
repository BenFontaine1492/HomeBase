<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSettings } from '@/composables/useSettings'
import { DEFAULT_DUE_SOON_DAYS, DUE_SOON_SHARE } from '@/types/maintenance-schedule'
import { MAX_DUE_SOON_DAYS } from '@/types/settings'
import { describeError } from '@/utils/error'

/** Settings → Maintenance: when a task counts as "due soon". */
type WindowMode = 'automatic' | 'custom'

const store = useSettings()

const mode = ref<WindowMode>('automatic')
const days = ref('')
const isSaving = ref(false)
const status = ref<{ type: 'success' | 'error'; text: string } | null>(null)

const automaticText = `${DEFAULT_DUE_SOON_DAYS} days before the due date, but at most ${DUE_SOON_SHARE * 100} % of the interval
  (yearly: ${DEFAULT_DUE_SOON_DAYS} days, monthly: 3 days, weekly: 1 day).`

const customDays = computed<number>(() => Number(days.value.trim()))
const isValid = computed<boolean>(
  () =>
    mode.value === 'automatic' ||
    (Number.isSafeInteger(customDays.value) && customDays.value >= 1 && customDays.value <= MAX_DUE_SOON_DAYS),
)

const rules = {
  days: (): true | string => isValid.value || `Enter a whole number from 1 to ${MAX_DUE_SOON_DAYS}`,
}

/** Shows the stored setting. */
function resetForm(): void {
  const stored = store.settings.value.maintenanceDueSoonDays
  mode.value = stored === null ? 'automatic' : 'custom'
  days.value = stored === null ? '' : String(stored)
}

watch(() => store.settings.value.maintenanceDueSoonDays, resetForm)

async function save(): Promise<void> {
  if (!isValid.value || isSaving.value) return
  isSaving.value = true
  status.value = null
  try {
    await store.setMaintenanceDueSoonDays(mode.value === 'automatic' ? null : customDays.value)
    status.value = { type: 'success', text: 'Saved.' }
  } catch (error) {
    console.error(error)
    status.value = { type: 'error', text: describeError(error) }
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  await store.ensureLoaded()
  resetForm()
})
</script>

<template>
  <v-card class="settings-card">
    <div class="settings-card__title">“Due soon” window</div>
    <p class="settings-card__text">
      Maintenance tasks are marked <strong>Due soon</strong> for a while before their due date, and
      <strong>Overdue</strong> after it.
    </p>

    <v-alert v-if="store.error.value" type="error" density="compact" class="mb-4">
      Could not load the settings: {{ store.error.value }}
    </v-alert>

    <v-radio-group
      :model-value="mode"
      hide-details
      class="mb-2"
      @update:model-value="(value: WindowMode | null) => (mode = value ?? 'automatic')"
    >
      <v-radio value="automatic" color="primary">
        <template #label>
          <div>
            <div class="settings-card__option">Automatic</div>
            <div class="settings-card__hint">{{ automaticText }}</div>
          </div>
        </template>
      </v-radio>
      <v-radio value="custom" color="primary">
        <template #label>
          <div class="settings-card__option">Custom number of days for every task</div>
        </template>
      </v-radio>
    </v-radio-group>

    <v-text-field
      v-if="mode === 'custom'"
      v-model="days"
      label="Days before the due date"
      v-bind="{ inputmode: 'numeric' }"
      :rules="[rules.days]"
      max-width="280"
      class="ml-10"
    />

    <v-alert v-if="status" :type="status.type" density="compact" class="mb-4">{{ status.text }}</v-alert>

    <div class="d-flex">
      <v-spacer />
      <v-btn color="primary" variant="flat" :loading="isSaving" :disabled="!isValid" v-bind="{ onClick: save }">
        Save
      </v-btn>
    </div>
  </v-card>
</template>

<style scoped>
.settings-card {
  padding: 24px;
}

.settings-card__title {
  font-size: 1rem;
  font-weight: 600;
}

.settings-card__text {
  margin: 6px 0 16px;
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.settings-card__option {
  font-size: 0.9375rem;
  font-weight: 500;
  color: rgb(var(--v-theme-on-surface));
}

.settings-card__hint {
  font-size: 0.8125rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
</style>
