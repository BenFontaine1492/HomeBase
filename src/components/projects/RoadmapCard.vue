<script setup lang="ts">
import { computed, ref } from 'vue'
import RoadmapChart from './RoadmapChart.vue'
import { t } from '@/i18n'
import { ROADMAP_YEARS, type RoadmapChartData, type RoadmapNotice, type RoadmapTarget } from '@/types/project-roadmap'

/**
 * The savings roadmap of all projects or of one: key figures, the chart (Savings or
 * Timeline) and how it is calculated. A notice replaces the chart when there is
 * nothing to draw, or points out investments beyond reach.
 */
const props = defineProps<{
  title: string
  subtitle: string
  data: RoadmapChartData
  /** Key figures above the chart, e.g. the net per month. */
  figures: readonly { label: string; value: string }[]
  notice: RoadmapNotice | null
}>()

const emit = defineEmits<{
  open: [target: RoadmapTarget]
}>()

const mode = ref<'savings' | 'timeline'>('savings')

const hasChart = computed<boolean>(() => props.data.bars.length > 0)

const noticeText = computed<string | null>(() =>
  props.notice ? t(`projects.roadmap.notices.${props.notice}`, { years: ROADMAP_YEARS }) : null,
)
</script>

<template>
  <v-card class="roadmap-card">
    <div class="roadmap-card__head">
      <div>
        <h2 class="hb-subtitle">{{ title }}</h2>
        <p class="hb-caption text-medium-emphasis roadmap-card__subtitle">{{ subtitle }}</p>
      </div>
      <v-btn-toggle v-if="hasChart" v-model="mode" mandatory v-bind="{ 'aria-label': t('projects.roadmap.chart') }">
        <v-btn value="savings" prepend-icon="mdi-chart-areaspline" size="small">
          {{ t('projects.roadmap.savings') }}
        </v-btn>
        <v-btn value="timeline" prepend-icon="mdi-chart-timeline" size="small">
          {{ t('projects.roadmap.timeline') }}
        </v-btn>
      </v-btn-toggle>
    </div>

    <dl class="roadmap-card__figures">
      <div v-for="figure in figures" :key="figure.label">
        <dt class="hb-caption text-medium-emphasis">{{ figure.label }}</dt>
        <dd class="hb-body-strong hb-numeric">{{ figure.value }}</dd>
      </div>
    </dl>

    <RoadmapChart v-if="hasChart" :data="data" :mode="mode" @open="(target) => emit('open', target)" />

    <v-alert v-if="noticeText" :type="hasChart ? 'warning' : 'info'" variant="tonal">
      {{ noticeText }}
      <template v-if="notice !== 'nothing-planned'" #append>
        <v-btn variant="text" size="small" :to="{ name: 'finances', query: { tab: 'recurring' } }">
          {{ t('projects.roadmap.toRecurring') }}
        </v-btn>
      </template>
    </v-alert>

    <v-alert type="info" variant="tonal" icon="mdi-information-outline">
      {{ t('projects.roadmap.explanation') }}
    </v-alert>
  </v-card>
</template>

<style scoped>
.roadmap-card {
  display: grid;
  gap: 16px;
  padding: 24px;
}

.roadmap-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.roadmap-card__subtitle {
  margin-top: 4px;
}

.roadmap-card__figures {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 32px;
  margin: 0;
}

.roadmap-card__figures dd {
  margin: 0;
}
</style>
