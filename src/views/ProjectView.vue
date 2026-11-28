<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActionsMenu from '@/components/common/ActionsMenu.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import CostFormDialog from '@/components/costs/CostFormDialog.vue'
import HouseholdObjectFormDialog from '@/components/inventory/HouseholdObjectFormDialog.vue'
import InvestmentFormDialog from '@/components/investments/InvestmentFormDialog.vue'
import InvestmentPriorityList from '@/components/investments/InvestmentPriorityList.vue'
import MarkPurchasedDialog from '@/components/investments/MarkPurchasedDialog.vue'
import PurchasedInvestmentList from '@/components/investments/PurchasedInvestmentList.vue'
import ProjectFormDialog from '@/components/projects/ProjectFormDialog.vue'
import RoadmapCard from '@/components/projects/RoadmapCard.vue'
import { useInvestments } from '@/composables/useInvestments'
import { useProjectRoadmap } from '@/composables/useProjectRoadmap'
import { useProjects } from '@/composables/useProjects'
import { t } from '@/i18n'
import { costCategoryName, type CostInput } from '@/types/cost'
import type { HouseholdObjectInput } from '@/types/household-object'
import { plannedInvestments, purchasedInvestments, type Investment } from '@/types/investment'
import { projectChart, roadmapNotice, type RoadmapChartData, type RoadmapTarget } from '@/types/project-roadmap'
import { formatCents } from '@/utils/currency'
import { formatDate, monthsBetween, todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'

/** Route param: the project id. ?investment= opens that investment for editing. */
const props = defineProps<{
  projectId: string
}>()

const route = useRoute()
const router = useRouter()

const projectStore = useProjects()
const investmentStore = useInvestments()
const { roadmap, ensureLoaded } = useProjectRoadmap()
const { moveInvestment, markPlanned, deleteInvestment } = investmentStore

const id = computed<number>(() => Number(props.projectId))
const forecast = computed(() => roadmap.value.projects.find((candidate) => candidate.project.id === id.value))
const project = computed(() => forecast.value?.project)

const planned = computed<Investment[]>(() => plannedInvestments(investmentStore.investments.value, id.value))
const purchased = computed<Investment[]>(() =>
  purchasedInvestments(investmentStore.investments.value).filter((investment) => investment.projectId === id.value),
)

const isLoading = computed<boolean>(() => projectStore.isLoading.value || investmentStore.isLoading.value)
const loadError = computed<string | null>(() => projectStore.error.value ?? investmentStore.error.value)
const hasLoaded = ref(false)

const today = todayIsoDate()

const chart = computed<RoadmapChartData | null>(() => projectChart(roadmap.value, id.value, today))
const notice = computed(() =>
  roadmapNotice(
    (forecast.value?.investments ?? []).map((investment) => investment.aloneDate),
    roadmap.value.hasRecurring,
  ),
)

/** E.g. "25 Sep 2027, in 10 months"; "Not reachable" without a date. */
function doneText(date: string | null): string {
  if (date === null) return t('projects.roadmap.notReachable')
  const months = monthsBetween(today, date)
  return months === 0 ? formatDate(date) : t('projects.roadmap.doneIn', { date: formatDate(date), count: months })
}

const figures = computed(() => [
  { label: t('projects.roadmap.needed'), value: formatCents(forecast.value?.neededCents ?? 0) },
  { label: t('projects.roadmap.doneAlone'), value: doneText(forecast.value?.aloneDate ?? null) },
  // With only one project there are no projects before it, so the in-order date would only repeat the one above.
  ...(roadmap.value.projects.length > 1
    ? [{ label: t('projects.roadmap.doneInOrder'), value: doneText(forecast.value?.date ?? null) }]
    : []),
])

const isFormDialogOpen = ref(false)
/** null = create mode, otherwise the investment being edited. */
const investmentToEdit = ref<Investment | null>(null)

const isDeleteDialogOpen = ref(false)
const investmentToDelete = ref<Investment | null>(null)

const isPurchaseDialogOpen = ref(false)
const investmentToPurchase = ref<Investment | null>(null)

const isProjectDialogOpen = ref(false)
const isDeleteProjectDialogOpen = ref(false)

/** "Convert to inventory object": the object form, filled in from the investment. */
const isObjectDialogOpen = ref(false)
const objectPrefill = ref<HouseholdObjectInput | null>(null)

/** "Record as a cost": the cost form, filled in from the investment (after the object form, if both). */
const isCostDialogOpen = ref(false)
const costPrefill = ref<Partial<CostInput> | null>(null)
/** The purchase whose cost form waits for the object form to close. */
let pendingCost: { investment: Investment; purchasedDate: string } | null = null

/** Error of reordering or moving back to planned. */
const changeError = ref<string | null>(null)

const projectActions = computed(() => [
  { title: t('projects.menu.edit'), icon: 'mdi-pencil-outline', onSelect: () => (isProjectDialogOpen.value = true) },
  {
    title: t('projects.menu.delete'),
    icon: 'mdi-trash-can-outline',
    danger: true,
    onSelect: () => (isDeleteProjectDialogOpen.value = true),
  },
])

function openCreateDialog(): void {
  investmentToEdit.value = null
  isFormDialogOpen.value = true
}

function openEditDialog(investment: Investment): void {
  investmentToEdit.value = investment
  isFormDialogOpen.value = true
}

function openDeleteDialog(investment: Investment): void {
  investmentToDelete.value = investment
  isDeleteDialogOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (investmentToDelete.value) await deleteInvestment(investmentToDelete.value.id)
}

async function deleteThisProject(): Promise<void> {
  await projectStore.deleteProject(id.value)
}

function openPurchaseDialog(investment: Investment): void {
  investmentToPurchase.value = investment
  isPurchaseDialogOpen.value = true
}

function openObjectDialog(investment: Investment, purchasedDate: string | null): void {
  objectPrefill.value = {
    name: investment.title,
    categoryId: null,
    purchaseDate: purchasedDate,
    purchasePriceCents: investment.estimatedCostCents,
    notes: investment.description,
  }
  isObjectDialogOpen.value = true
}

function openCostDialog(investment: Investment, paidDate: string): void {
  costPrefill.value = {
    description: investment.title,
    paidDate,
    amountCents: investment.estimatedCostCents,
    category: costCategoryName('purchase'),
    investmentId: investment.id,
  }
  isCostDialogOpen.value = true
}

function onPurchased(
  investment: Investment,
  purchasedDate: string,
  next: { addToInventory: boolean; recordCost: boolean },
): void {
  if (next.addToInventory) {
    openObjectDialog(investment, purchasedDate)
    pendingCost = next.recordCost ? { investment, purchasedDate } : null
  } else if (next.recordCost) {
    openCostDialog(investment, purchasedDate)
  }
}

// One dialog at a time: the cost form opens when the object form is closed.
watch(isObjectDialogOpen, (isOpen) => {
  if (isOpen || pendingCost === null) return
  const { investment, purchasedDate } = pendingCost
  pendingCost = null
  openCostDialog(investment, purchasedDate)
})

async function change(action: () => Promise<void>): Promise<void> {
  changeError.value = null
  try {
    await action()
  } catch (cause) {
    console.error(cause)
    changeError.value = describeError(cause)
  }
}

/** A click on a purchase in the chart opens it for editing. */
function openTarget(target: RoadmapTarget): void {
  if (target.kind !== 'investment') return
  const investment = investmentStore.investments.value.find((candidate) => candidate.id === target.investmentId)
  if (investment) openEditDialog(investment)
}

function retry(): void {
  void Promise.all([projectStore.refresh(), investmentStore.refresh()])
}

// ?investment= (from the overview's chart or the search): open it once, then drop it from the URL.
watch([hasLoaded, () => route.query.investment], ([loaded, investmentId]) => {
  if (!loaded || typeof investmentId !== 'string') return
  const investment = investmentStore.investments.value.find(
    (candidate) => candidate.id === Number(investmentId) && candidate.projectId === id.value,
  )
  if (investment) openEditDialog(investment)
  void router.replace({ query: { ...route.query, investment: undefined } })
})

// Unknown or deleted project → back to the overview (once the data is loaded).
watch([hasLoaded, project], () => {
  if (hasLoaded.value && !loadError.value && !project.value) void router.replace({ name: 'projects' })
})

onMounted(async () => {
  await ensureLoaded()
  hasLoaded.value = true
})
</script>

<template>
  <div>
    <PageHeader
      :title="project?.name ?? ''"
      :subtitle="project?.description ?? undefined"
      :breadcrumbs="[{ title: t('nav.projects'), to: { name: 'projects' } }]"
    >
      <template #actions>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" v-bind="{ onClick: openCreateDialog }">
          {{ t('investments.add') }}
        </v-btn>
        <ActionsMenu v-if="project" :label="t('common.actionsFor', { name: project.name })" :actions="projectActions" />
      </template>
    </PageHeader>

    <v-alert v-if="loadError" type="error" class="mb-6" :title="t('projects.loadError')">
      {{ loadError }}
      <template #append>
        <v-btn variant="text" size="small" v-bind="{ onClick: retry }">{{ t('common.retry') }}</v-btn>
      </template>
    </v-alert>

    <v-alert v-if="changeError" type="error" class="mb-6" closable @click:close="changeError = null">
      {{ changeError }}
    </v-alert>

    <RoadmapCard
      v-if="chart"
      :title="t('projects.roadmap.title')"
      :subtitle="t('projects.roadmap.projectSubtitle')"
      :data="chart"
      :figures="figures"
      :notice="notice"
      class="mb-6"
      @open="openTarget"
    />

    <InvestmentPriorityList
      :investments="planned"
      :loading="isLoading"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
      @purchase="openPurchaseDialog"
      @move="(investmentId, toIndex) => change(() => moveInvestment(investmentId, toIndex))"
    />

    <PurchasedInvestmentList
      v-if="purchased.length > 0"
      :investments="purchased"
      class="mt-6"
      @edit="openEditDialog"
      @delete="openDeleteDialog"
      @plan="(investment) => change(() => markPlanned(investment))"
      @to-inventory="(investment) => openObjectDialog(investment, investment.purchasedDate)"
    />

    <InvestmentFormDialog v-model="isFormDialogOpen" :investment="investmentToEdit" :project-id="id" />
    <ConfirmDialog v-model="isDeleteDialogOpen" :title="t('investments.delete.title')" :action="deleteSelected">
      <template v-if="investmentToDelete">
        {{
          t('investments.delete.text', {
            title: investmentToDelete.title,
            cost: formatCents(investmentToDelete.estimatedCostCents),
          })
        }}
      </template>
    </ConfirmDialog>
    <ProjectFormDialog v-model="isProjectDialogOpen" :project="project ?? null" />
    <ConfirmDialog v-model="isDeleteProjectDialogOpen" :title="t('projects.delete.title')" :action="deleteThisProject">
      <template v-if="project">
        {{ t('projects.delete.text', { name: project.name, count: planned.length + purchased.length }) }}
      </template>
    </ConfirmDialog>
    <MarkPurchasedDialog v-model="isPurchaseDialogOpen" :investment="investmentToPurchase" @purchased="onPurchased" />
    <HouseholdObjectFormDialog v-model="isObjectDialogOpen" :prefill="objectPrefill" />
    <CostFormDialog v-model="isCostDialogOpen" :prefill="costPrefill" />
  </div>
</template>
