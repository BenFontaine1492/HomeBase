<script setup lang="ts">
/** The "More" (⋯) button of a row or a tile, with its menu of actions. */
defineProps<{
  /** Accessible name of the button, e.g. "Actions for Gas boiler". */
  label: string
  actions: readonly { title: string; icon: string; onSelect: () => void; danger?: boolean; disabled?: boolean }[]
}>()
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn v-bind="{ ...menuProps, 'aria-label': label }" icon="mdi-dots-horizontal" variant="text" size="small" />
    </template>
    <v-list density="compact" min-width="180">
      <v-list-item
        v-for="action in actions"
        :key="action.title"
        :prepend-icon="action.icon"
        :title="action.title"
        :disabled="action.disabled"
        :base-color="action.danger ? 'error' : undefined"
        @click="action.onSelect"
      />
    </v-list>
  </v-menu>
</template>
