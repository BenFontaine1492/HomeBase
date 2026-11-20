<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ListSection from '@/components/common/ListSection.vue'
import { useAutoSave } from '@/composables/useAutoSave'
import { useNotifications } from '@/composables/useNotifications'
import { useSettings } from '@/composables/useSettings'
import { t } from '@/i18n'
import { DEFAULT_DUE_SOON_DAYS, DUE_SOON_SHARE } from '@/types/maintenance-schedule'
import { MAX_DUE_SOON_DAYS } from '@/types/settings'

/** Settings → Maintenance: when a task counts as "due soon". Each change is saved at once. */
type WindowMode = 'automatic' | 'custom'

/** Typing waits a moment, so "14" is saved once and not first as "1". */
const SAVE_DELAY_MS = 600

const store = useSettings()
const { notify } = useNotifications()

const mode = ref<WindowMode>('automatic')
const days = ref('')

const automaticText = computed<string>(() =>
  t('settings.maintenance.automaticHint', { days: DEFAULT_DUE_SOON_DAYS, share: DUE_SOON_SHARE * 100 }),
)

const customDays = computed<number>(() => Number(days.value.trim()))
const isValid = computed<boolean>(
  () =>
    mode.value === 'automatic' ||
    (Number.isSafeInteger(customDays.value) && customDays.value >= 1 && customDays.value <= MAX_DUE_SOON_DAYS),
)

const rules = {
  days: (): true | string => isValid.value || t('common.wholeNumberRange', { max: MAX_DUE_SOON_DAYS }),
}

const { error: saveError, save } = useAutoSave(
  () => store.setMaintenanceDueSoonDays(mode.value === 'automatic' ? null : customDays.value),
  () => notify(t('common.saved')),
)

let pendingSave: ReturnType<typeof setTimeout> | undefined

function onModeChange(value: WindowMode | null): void {
  mode.value = value ?? 'automatic'
  if (isValid.value) void save()
}

function saveDays(): void {
  pendingSave = undefined
  void save()
}

function onDaysInput(): void {
  clearTimeout(pendingSave)
  pendingSave = isValid.value ? setTimeout(saveDays, SAVE_DELAY_MS) : undefined
}

// The stored setting, once (a save reloads it; a reset then could undo typing meanwhile).
onMounted(async () => {
  await store.ensureLoaded()
  const stored = store.settings.value.maintenanceDueSoonDays
  mode.value = stored === null ? 'automatic' : 'custom'
  days.value = stored === null ? '' : String(stored)
})

// Leaving the page right after typing still saves.
onBeforeUnmount(() => {
  if (pendingSave === undefined) return
  clearTimeout(pendingSave)
  saveDays()
})
</script>

<template>
  <div class="hb-sections">
    <v-alert v-if="store.error.value" type="error" density="compact">
      {{ t('settings.loadError', { error: store.error.value }) }}
    </v-alert>
    <v-alert v-if="saveError" type="error" density="compact">{{ saveError }}</v-alert>

    <ListSection :title="t('settings.maintenance.title')" :subtitle="t('settings.maintenance.text')">
      <v-card class="pa-4">
        <v-radio-group
          :model-value="mode"
          hide-details
          @update:model-value="(value: WindowMode | null) => onModeChange(value)"
        >
          <v-radio value="automatic">
            <template #label>
              <div>
                <div class="radio-label">{{ t('settings.maintenance.automatic') }}</div>
                <div class="hb-caption text-medium-emphasis">{{ automaticText }}</div>
              </div>
            </template>
          </v-radio>
          <v-radio value="custom">
            <template #label>
              <div class="radio-label">{{ t('settings.maintenance.custom') }}</div>
            </template>
          </v-radio>
        </v-radio-group>

        <v-text-field
          v-if="mode === 'custom'"
          v-model="days"
          :label="t('settings.maintenance.daysLabel')"
          v-bind="{ inputmode: 'numeric' }"
          :rules="[rules.days]"
          max-width="280"
          class="ml-10 mt-2"
          @update:model-value="onDaysInput"
        />
      </v-card>
    </ListSection>
  </div>
</template>

<style scoped>
/* Radio labels are dimmed by Vuetify; the option names keep the normal text colour. */
.radio-label {
  color: rgba(var(--v-theme-on-surface), var(--v-high-emphasis-opacity));
}
</style>
