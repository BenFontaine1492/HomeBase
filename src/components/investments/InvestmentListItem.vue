<script setup lang="ts">
import { computed } from 'vue'
import PriorityChip from './PriorityChip.vue'
import { t } from '@/i18n'
import { isOverBudget, savingsProgress, type Investment } from '@/types/investment'
import { formatCents } from '@/utils/currency'
import { formatDate, todayIsoDate } from '@/utils/date'

/**
 * One investment. Planned ones show their rank and (in a list of several) a drag
 * handle; purchased ones their purchase date. The ⋮ menu offers what fits the status.
 */
const props = defineProps<{
  investment: Investment
  /** Position in the priority list; null for purchased investments. */
  rank: number | null
  /** Shows the drag handle and Move up / Move down. */
  reorderable?: boolean
  isFirst?: boolean
  isLast?: boolean
}>()

const emit = defineEmits<{
  edit: [investment: Investment]
  delete: [investment: Investment]
  purchase: [investment: Investment]
  plan: [investment: Investment]
  toInventory: [investment: Investment]
  move: [delta: -1 | 1]
}>()

const isPlanned = computed<boolean>(() => props.investment.status === 'planned')
const savings = computed(() => (isPlanned.value ? savingsProgress(props.investment, todayIsoDate()) : null))
const overBudget = computed<boolean>(() => isOverBudget(props.investment))

/** "Target 1 Mar 2027 · Budget €2,000" or "Purchased on 4 Nov 2026". */
const details = computed<string>(() => {
  const { purchasedDate, targetDate, budgetCents } = props.investment
  if (!isPlanned.value && purchasedDate) return t('investments.item.purchasedOn', { date: formatDate(purchasedDate) })
  return [
    targetDate && t('investments.item.target', { date: formatDate(targetDate) }),
    budgetCents !== null && t('investments.item.budget', { amount: formatCents(budgetCents) }),
  ]
    .filter(Boolean)
    .join(' · ')
})

const savingsText = computed<string | null>(() => {
  if (!savings.value) return null
  const { savedCents, goalCents, monthlyCents, remainingCents } = savings.value
  const saved = t('investments.item.saved', { saved: formatCents(savedCents), goal: formatCents(goalCents) })
  if (monthlyCents === null || remainingCents === 0) return saved
  return `${saved} · ${t('investments.item.perMonth', { amount: formatCents(monthlyCents) })}`
})
</script>

<template>
  <div class="investment-item">
    <v-icon
      v-if="reorderable"
      icon="mdi-drag-vertical"
      class="investment-item__handle"
      size="20"
      v-bind="{ 'aria-hidden': 'true', title: t('investments.item.dragHint') }"
    />
    <div v-if="rank !== null" class="investment-item__rank">{{ rank }}</div>
    <div v-else class="investment-item__rank investment-item__rank--done">
      <v-icon icon="mdi-check" size="18" />
    </div>
    <div class="investment-item__content">
      <div class="investment-item__title">{{ investment.title }}</div>
      <div v-if="investment.description" class="investment-item__description">
        {{ investment.description }}
      </div>
      <div v-if="details || overBudget" class="investment-item__details">
        {{ details }}
        <v-chip v-if="overBudget && isPlanned" color="warning" size="x-small" variant="tonal" class="ml-1">
          {{ t('investments.item.overBudget') }}
        </v-chip>
      </div>
      <div v-if="savings" class="investment-item__savings">
        <v-progress-linear :model-value="savings.share * 100" color="success" rounded height="6" />
        <span>{{ savingsText }}</span>
      </div>
    </div>
    <PriorityChip v-if="isPlanned" :priority="investment.priority" class="investment-item__priority" />
    <div class="investment-item__cost">
      <div class="investment-item__cost-value">{{ formatCents(investment.estimatedCostCents) }}</div>
      <div class="investment-item__cost-label">{{ t('investments.item.estimated') }}</div>
    </div>
    <v-menu location="bottom end">
      <template #activator="{ props: menuProps }">
        <v-btn
          v-bind="{ ...menuProps, 'aria-label': t('common.actionsFor', { name: investment.title }) }"
          icon="mdi-dots-vertical"
          variant="text"
          size="small"
          density="comfortable"
          class="investment-item__actions"
        />
      </template>
      <v-list density="compact" min-width="200" rounded="lg">
        <v-list-item prepend-icon="mdi-pencil-outline" :title="t('common.edit')" @click="emit('edit', investment)" />
        <template v-if="isPlanned">
          <v-list-item
            prepend-icon="mdi-cart-check"
            :title="t('investments.item.markPurchased')"
            @click="emit('purchase', investment)"
          />
          <template v-if="reorderable">
            <v-list-item
              prepend-icon="mdi-arrow-up"
              :title="t('common.moveUp')"
              :disabled="isFirst"
              @click="emit('move', -1)"
            />
            <v-list-item
              prepend-icon="mdi-arrow-down"
              :title="t('common.moveDown')"
              :disabled="isLast"
              @click="emit('move', 1)"
            />
          </template>
        </template>
        <template v-else>
          <v-list-item
            prepend-icon="mdi-package-variant-plus"
            :title="t('investments.item.toInventory')"
            @click="emit('toInventory', investment)"
          />
          <v-list-item
            prepend-icon="mdi-undo-variant"
            :title="t('investments.item.backToPlanned')"
            @click="emit('plan', investment)"
          />
        </template>
        <v-list-item
          prepend-icon="mdi-trash-can-outline"
          :title="t('common.delete')"
          base-color="error"
          @click="emit('delete', investment)"
        />
      </v-list>
    </v-menu>
  </div>
</template>

<style scoped>
.investment-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px 16px 12px;
  transition: background-color 0.15s ease;
}

.investment-item:hover {
  background: rgba(var(--v-theme-primary), 0.03);
}

.investment-item__handle {
  cursor: grab;
  color: rgba(var(--v-theme-on-surface), 0.3);
  transition: color 0.15s ease;
}

.investment-item:hover .investment-item__handle {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.investment-item__rank {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.08);
}

.investment-item__rank--done {
  color: rgb(var(--v-theme-success));
  background: rgba(var(--v-theme-success), 0.1);
}

.investment-item__content {
  flex: 1;
  min-width: 0;
}

.investment-item__title {
  font-size: 0.9375rem;
  font-weight: 600;
}

.investment-item__description {
  margin-top: 2px;
  overflow: hidden;
  font-size: 0.8125rem;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.investment-item__details {
  margin-top: 2px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.investment-item__savings {
  display: grid;
  grid-template-columns: minmax(80px, 160px) auto;
  gap: 10px;
  align-items: center;
  margin-top: 6px;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.investment-item__priority {
  flex-shrink: 0;
}

.investment-item__cost {
  flex-shrink: 0;
  min-width: 110px;
  text-align: right;
}

.investment-item__cost-value {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.investment-item__actions {
  flex-shrink: 0;
  margin-right: -8px;
  color: rgba(var(--v-theme-on-surface), 0.55);
}

.investment-item__cost-label {
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
