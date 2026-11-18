<script setup lang="ts">
import { ref, watch } from 'vue'
import { useInvestments } from '@/composables/useInvestments'
import { t } from '@/i18n'
import type { Investment } from '@/types/investment'
import { isValidIsoDate, todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'

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

const purchasedDate = ref('')
const addToInventory = ref(true)
const isSaving = ref(false)
const saveError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (!isOpen) return
  purchasedDate.value = todayIsoDate()
  addToInventory.value = true
  saveError.value = null
})

async function confirm(): Promise<void> {
  const { investment } = props
  if (!investment || isSaving.value || !isValidIsoDate(purchasedDate.value)) return
  isSaving.value = true
  saveError.value = null
  try {
    await markPurchased(investment, purchasedDate.value)
    open.value = false
    emit('purchased', investment, purchasedDate.value, addToInventory.value)
  } catch (error) {
    console.error(error)
    saveError.value = describeError(error)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="480" :persistent="isSaving">
    <v-card v-if="investment" class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">
        {{ t('investments.purchase.title') }}
      </v-card-title>
      <v-card-subtitle class="px-6">{{ investment.title }}</v-card-subtitle>

      <v-form class="px-6 pt-6" @submit.prevent="confirm">
        <v-text-field
          v-model="purchasedDate"
          :label="t('investments.purchase.date')"
          type="date"
          :rules="[(value: string) => isValidIsoDate(value) || t('common.required')]"
        />
        <v-checkbox
          :model-value="addToInventory"
          @update:model-value="(checked: boolean | null) => (addToInventory = checked === true)"
          :label="t('investments.purchase.addToInventory')"
          color="primary"
          :hint="t('investments.purchase.addToInventoryHint')"
          persistent-hint
          class="mb-4"
        />

        <v-alert v-if="saveError" type="error" class="mb-4" density="compact">{{ saveError }}</v-alert>

        <v-card-actions class="px-0 pb-4">
          <v-spacer />
          <v-btn variant="text" :disabled="isSaving" v-bind="{ onClick: () => (open = false) }">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            v-bind="{ type: 'submit' }"
            color="primary"
            variant="flat"
            :loading="isSaving"
            :disabled="!isValidIsoDate(purchasedDate)"
          >
            {{ t('investments.purchase.confirm') }}
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
