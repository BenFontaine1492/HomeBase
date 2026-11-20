<script setup lang="ts">
import ListRow from '@/components/common/ListRow.vue'

/**
 * One setting or action as its own card, like a Windows SettingsCard: an optional icon,
 * the title (and a description) on the left, the control or button (default slot) on the
 * right. With `labelFor` (the control's id) the title is the label of the control.
 */
defineProps<{
  title: string
  description?: string
  icon?: string
  labelFor?: string
}>()
</script>

<template>
  <ListRow>
    <template v-if="icon" #prepend>
      <v-icon :icon="icon" size="24" class="text-medium-emphasis" />
    </template>
    <label v-if="labelFor" :for="labelFor" class="settings-row__title">{{ title }}</label>
    <div v-else>{{ title }}</div>
    <div v-if="description" class="hb-caption text-medium-emphasis">{{ description }}</div>
    <template #append>
      <div class="settings-row__control">
        <slot />
      </div>
    </template>
  </ListRow>
</template>

<style scoped>
.settings-row__title {
  display: block;
}

/* Action buttons of all settings rows share one width, so a column of them lines up. */
.settings-row__control > :deep(.v-btn) {
  min-width: 176px;
}
</style>
