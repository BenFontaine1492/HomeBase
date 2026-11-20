<script setup lang="ts">
import { computed } from 'vue'
import PriorityChip from './PriorityChip.vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { t } from '@/i18n'
import { isOverBudget, savingsProgress, type Investment } from '@/types/investment'
import { formatCents } from '@/utils/currency'
import { formatDate, todayIsoDate } from '@/utils/date'

/**
 * One investment. Planned ones show their rank and (in a list of several) a drag
 * handle; purchased ones their purchase date. The ⋯ menu offers what fits the status.
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
const overBudget = computed<boolean>(() => isPlanned.value && isOverBudget(props.investment))

/** "Target 1 Mar 2027", "Budget €2,000", or "Purchased on 4 Nov 2026". */
const details = computed<(string | null)[]>(() => {
  const { purchasedDate, targetDate, budgetCents } = props.investment
  if (!isPlanned.value && purchasedDate) return [t('investments.item.purchasedOn', { date: formatDate(purchasedDate) })]
  return [
    targetDate === null ? null : t('investments.item.target', { date: formatDate(targetDate) }),
    budgetCents === null ? null : t('investments.item.budget', { amount: formatCents(budgetCents) }),
  ]
})

const savingsDetails = computed<(string | null)[]>(() => {
  if (!savings.value) return []
  const { savedCents, goalCents, monthlyCents, remainingCents } = savings.value
  return [
    t('investments.item.saved', { saved: formatCents(savedCents), goal: formatCents(goalCents) }),
    monthlyCents === null || remainingCents === 0
      ? null
      : t('investments.item.perMonth', { amount: formatCents(monthlyCents) }),
  ]
})

const actions = computed(() => {
  const { investment } = props
  const edit = { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', investment) }
  const remove = {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', investment),
  }
  if (!isPlanned.value) {
    return [
      edit,
      {
        title: t('investments.item.toInventory'),
        icon: 'mdi-package-variant-plus',
        onSelect: () => emit('toInventory', investment),
      },
      {
        title: t('investments.item.backToPlanned'),
        icon: 'mdi-undo-variant',
        onSelect: () => emit('plan', investment),
      },
      remove,
    ]
  }
  const moves = props.reorderable
    ? [
        { title: t('common.moveUp'), icon: 'mdi-arrow-up', disabled: props.isFirst, onSelect: () => emit('move', -1) },
        {
          title: t('common.moveDown'),
          icon: 'mdi-arrow-down',
          disabled: props.isLast,
          onSelect: () => emit('move', 1),
        },
      ]
    : []
  const purchase = {
    title: t('investments.item.markPurchased'),
    icon: 'mdi-cart-check',
    onSelect: () => emit('purchase', investment),
  }
  return [edit, purchase, ...moves, remove]
})
</script>

<template>
  <ListRow>
    <template #prepend>
      <v-icon
        v-if="reorderable"
        icon="mdi-drag-vertical"
        size="20"
        class="investment-item__handle text-medium-emphasis"
        v-bind="{ 'aria-hidden': 'true', title: t('investments.item.dragHint') }"
      />
      <span v-if="rank !== null" class="investment-item__rank hb-body-strong text-medium-emphasis">{{ rank }}</span>
      <v-icon v-else icon="mdi-check-circle-outline" size="20" color="success" />
    </template>

    <div class="hb-body">{{ investment.title }}</div>
    <div v-if="investment.description" class="hb-caption text-medium-emphasis text-truncate">
      {{ investment.description }}
    </div>
    <MetaList :items="details">
      <StatusBadge v-if="overBudget" color="warning">{{ t('investments.item.overBudget') }}</StatusBadge>
    </MetaList>
    <div v-if="savings" class="investment-item__savings">
      <v-progress-linear :model-value="savings.share * 100" color="success" rounded height="4" />
      <MetaList :items="savingsDetails" />
    </div>

    <template #append>
      <PriorityChip v-if="isPlanned" :priority="investment.priority" />
      <div class="investment-item__cost">
        <div class="hb-body-strong hb-numeric">{{ formatCents(investment.estimatedCostCents) }}</div>
        <div class="hb-caption text-medium-emphasis">{{ t('investments.item.estimated') }}</div>
      </div>
      <ActionsMenu :label="t('common.actionsFor', { name: investment.title })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.investment-item__handle {
  cursor: grab;
}

.investment-item__rank {
  min-width: 20px;
  text-align: center;
}

.investment-item__savings {
  display: grid;
  grid-template-columns: minmax(80px, 160px) auto;
  gap: 12px;
  align-items: center;
  margin-top: 4px;
}

.investment-item__cost {
  min-width: 104px;
  text-align: right;
}
</style>
