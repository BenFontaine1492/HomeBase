<script setup lang="ts">
import { ref, useId, watch } from 'vue'
import AppDialog from '@/components/common/AppDialog.vue'
import DateField from '@/components/common/DateField.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useInvestments } from '@/composables/useInvestments'
import { t } from '@/i18n'
import type { Investment } from '@/types/investment'
import { isValidIsoDate, todayIsoDate } from '@/utils/date'

/**
 * Marks a planned investment as purchased. With "Add to inventory" checked, the
 * parent then opens the object form, filled in from the investment.
 */
const props = defineProps<{
  investment: Investment | null
}>()

const emit = defineEmits<{
  purchased: [investment: Investment, purchasedDate: string, addToInventory: boolean]
}>()

const open = defineModel<boolean>({ required: true })

const { markPurchased } = useInvestments()
const { isRunning: isSaving, error: saveError, run } = useAsyncAction()
const formId = useId()

const purchasedDate = ref('')
const addToInventory = ref(true)

watch(open, (isOpen) => {
  if (!isOpen) return
  purchasedDate.value = todayIsoDate()
  addToInventory.value = true
  saveError.value = null
})

function confirm(): Promise<void> {
  const { investment } = props
  if (!investment || !isValidIsoDate(purchasedDate.value)) return Promise.resolve()
  const date = purchasedDate.value
  return run(async () => {
    await markPurchased(investment, date)
    open.value = false
    emit('purchased', investment, date, addToInventory.value)
  })
}
</script>

<template>
  <AppDialog
    v-model="open"
    :title="t('investments.purchase.title')"
    :subtitle="investment?.title"
    size="small"
    :busy="isSaving"
    required-hint
  >
    <v-form v-bind="{ id: formId }" @submit.prevent="confirm">
      <DateField v-model="purchasedDate" :label="t('investments.purchase.date')" required />
      <v-checkbox
        :model-value="addToInventory"
        @update:model-value="(checked: boolean | null) => (addToInventory = checked === true)"
        :label="t('investments.purchase.addToInventory')"
        :hint="t('investments.purchase.addToInventoryHint')"
        persistent-hint
      />
    </v-form>
    <v-alert v-if="saveError" type="error" density="compact" class="mt-4">{{ saveError }}</v-alert>

    <template #actions>
      <v-btn
        v-bind="{ type: 'submit', form: formId }"
        color="primary"
        variant="flat"
        :loading="isSaving"
        :disabled="!isValidIsoDate(purchasedDate)"
      >
        {{ t('investments.purchase.confirm') }}
      </v-btn>
      <v-btn :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">{{ t('common.cancel') }}</v-btn>
    </template>
  </AppDialog>
</template>
