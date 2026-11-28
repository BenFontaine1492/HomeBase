<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProjectFormDialog from '@/components/projects/ProjectFormDialog.vue'
import ProjectTile from '@/components/projects/ProjectTile.vue'
import RoadmapCard from '@/components/projects/RoadmapCard.vue'
import { useInvestments } from '@/composables/useInvestments'
import { useProjectRoadmap } from '@/composables/useProjectRoadmap'
import { useProjects } from '@/composables/useProjects'
import { t } from '@/i18n'
import type { Project } from '@/types/project'
import {
  overviewChart,
  roadmapNotice,
  type ProjectForecast,
  type RoadmapChartData,
  type RoadmapTarget,
} from '@/types/project-roadmap'
import { formatCents } from '@/utils/currency'
import { formatDate, todayIsoDate } from '@/utils/date'
import { describeError } from '@/utils/error'

const router = useRouter()

const projectStore = useProjects()
const investmentStore = useInvestments()
const { roadmap, ensureLoaded } = useProjectRoadmap()
const { projects, moveProject, deleteProject } = projectStore

const isLoading = computed<boolean>(() => projectStore.isLoading.value || investmentStore.isLoading.value)
const loadError = computed<string | null>(() => projectStore.error.value ?? investmentStore.error.value)

const chart = computed<RoadmapChartData>(() => overviewChart(roadmap.value, todayIsoDate()))
const notice = computed(() =>
  roadmapNotice(
    roadmap.value.projects.flatMap((forecast) => forecast.investments.map((investment) => investment.date)),
    roadmap.value.hasRecurring,
  ),
)

const figures = computed(() => {
  const needed = roadmap.value.projects.reduce((sum, forecast) => sum + forecast.neededCents, 0)
  const done = roadmap.value.date
  return [
    { label: t('projects.roadmap.netPerMonth'), value: formatCents(roadmap.value.monthlyNetCents) },
    { label: t('projects.roadmap.needed'), value: formatCents(needed) },
    {
      label: t('projects.roadmap.allDone'),
      value: done === null ? t('projects.roadmap.notReachable') : formatDate(done),
    },
  ]
})

function summaryOf(forecast: ProjectForecast): string {
  return t('projects.tile.summary', { count: forecast.investments.length, amount: formatCents(forecast.neededCents) })
}

function statusOf(forecast: ProjectForecast): string {
  if (forecast.investments.length === 0) return t('projects.tile.nothingPlanned')
  if (forecast.date === null) return t('projects.roadmap.notReachable')
  return t('projects.tile.doneOn', { date: formatDate(forecast.date) })
}

const isFormDialogOpen = ref(false)
/** null = create mode, otherwise the project being edited. */
const projectToEdit = ref<Project | null>(null)
const isDeleteDialogOpen = ref(false)
const projectToDelete = ref<Project | null>(null)
/** Error of reordering. */
const changeError = ref<string | null>(null)

/** All investments of the project to delete, planned and purchased: they go with it. */
const deleteCount = computed<number>(
  () =>
    investmentStore.investments.value.filter((investment) => investment.projectId === projectToDelete.value?.id).length,
)

function openCreateDialog(): void {
  projectToEdit.value = null
  isFormDialogOpen.value = true
}

function openEditDialog(project: Project): void {
  projectToEdit.value = project
  isFormDialogOpen.value = true
}

function openDeleteDialog(project: Project): void {
  projectToDelete.value = project
  isDeleteDialogOpen.value = true
}

async function deleteSelected(): Promise<void> {
  if (projectToDelete.value) await deleteProject(projectToDelete.value.id)
}

async function move(project: Project, toIndex: number): Promise<void> {
  changeError.value = null
  try {
    await moveProject(project.id, toIndex)
  } catch (cause) {
    console.error(cause)
    changeError.value = describeError(cause)
  }
}

function openProject(projectId: number): void {
  void router.push({ name: 'project', params: { projectId: String(projectId) } })
}

/** A click in the chart opens the project, or the investment on its project's page. */
function openTarget(target: RoadmapTarget): void {
  if (target.kind === 'project') {
    openProject(target.projectId)
    return
  }
  void router.push({
    name: 'project',
    params: { projectId: String(target.projectId) },
    query: { investment: String(target.investmentId) },
  })
}

function retry(): void {
  void Promise.all([projectStore.refresh(), investmentStore.refresh()])
}

onMounted(() => {
  void ensureLoaded()
})
</script>

<template>
  <div>
    <PageHeader :title="t('nav.projects')" :subtitle="t('projects.subtitle')">
      <template #actions>
        <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" v-bind="{ onClick: openCreateDialog }">
          {{ t('projects.add') }}
        </v-btn>
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

    <div v-if="isLoading && projects.length === 0" class="project-grid">
      <v-skeleton-loader v-for="n in 3" :key="n" type="card" height="140" />
    </div>

    <v-card v-else-if="projects.length === 0">
      <EmptyState icon="mdi-folder-outline" :title="t('projects.emptyTitle')" :text="t('projects.emptyText')">
        <v-btn prepend-icon="mdi-plus" v-bind="{ onClick: openCreateDialog }">{{ t('projects.add') }}</v-btn>
      </EmptyState>
    </v-card>

    <template v-else>
      <RoadmapCard
        :title="t('projects.roadmap.title')"
        :subtitle="t('projects.roadmap.allSubtitle')"
        :data="chart"
        :figures="figures"
        :notice="notice"
        class="mb-6"
        @open="openTarget"
      />

      <div class="project-grid">
        <ProjectTile
          v-for="(forecast, index) in roadmap.projects"
          :key="forecast.project.id"
          :name="forecast.project.name"
          :description="forecast.project.description"
          :color-index="index"
          :summary="summaryOf(forecast)"
          :status="statusOf(forecast)"
          :to="{ name: 'project', params: { projectId: String(forecast.project.id) } }"
          :can-move-up="index > 0"
          :can-move-down="index < roadmap.projects.length - 1"
          @edit="openEditDialog(forecast.project)"
          @delete="openDeleteDialog(forecast.project)"
          @move-up="move(forecast.project, index - 1)"
          @move-down="move(forecast.project, index + 1)"
        />
      </div>
    </template>

    <ProjectFormDialog v-model="isFormDialogOpen" :project="projectToEdit" @created="openProject" />
    <ConfirmDialog v-model="isDeleteDialogOpen" :title="t('projects.delete.title')" :action="deleteSelected">
      <template v-if="projectToDelete">
        {{ t('projects.delete.text', { name: projectToDelete.name, count: deleteCount }) }}
      </template>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
</style>
