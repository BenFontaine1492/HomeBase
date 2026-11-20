<script setup lang="ts">
import { computed } from 'vue'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ListRow from '@/components/common/ListRow.vue'
import MetaList from '@/components/common/MetaList.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import MaintenanceStatusChip from '@/components/maintenance/MaintenanceStatusChip.vue'
import { t } from '@/i18n'
import type { HouseholdObject } from '@/types/household-object'
import type { MaintenanceSummary } from '@/types/maintenance-schedule'
import { formatCents } from '@/utils/currency'

const props = defineProps<{
  object: HouseholdObject
  /** Shown as a badge when set (List view). The category page omits it. */
  categoryName?: string
  categoryIcon?: string
  /** Shown as a badge when maintenance is overdue or due soon. */
  maintenance?: MaintenanceSummary
}>()

const emit = defineEmits<{
  open: [object: HouseholdObject]
  edit: [object: HouseholdObject]
  delete: [object: HouseholdObject]
}>()

/** "Bosch WTW87", "Basement". */
const details = computed<string[]>(() => [
  [props.object.manufacturer, props.object.model].filter(Boolean).join(' '),
  props.object.location ?? '',
])

const actions = computed(() => [
  { title: t('common.edit'), icon: 'mdi-pencil-outline', onSelect: () => emit('edit', props.object) },
  {
    title: t('common.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => emit('delete', props.object),
  },
])
</script>

<template>
  <ListRow clickable @open="emit('open', object)">
    <div class="hb-body text-truncate">{{ object.name }}</div>
    <MetaList :items="details" />

    <template #append>
      <MaintenanceStatusChip v-if="maintenance" :summary="maintenance" urgent-only />
      <StatusBadge v-if="categoryName" :icon="categoryIcon">{{ categoryName }}</StatusBadge>
      <div class="object-item__price hb-body-strong hb-numeric">
        <template v-if="object.purchasePriceCents !== null">{{ formatCents(object.purchasePriceCents) }}</template>
      </div>
      <ActionsMenu :label="t('common.actionsFor', { name: object.name })" :actions="actions" />
    </template>
  </ListRow>
</template>

<style scoped>
.object-item__price {
  min-width: 88px;
  text-align: right;
}
</style>
