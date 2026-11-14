<script setup lang="ts">
/** "⋮" menu with Edit / Delete for a category (tile and category page). */
defineProps<{
  categoryName: string
  size?: 'small' | 'default'
}>()

defineEmits<{
  edit: []
  delete: []
}>()
</script>

<template>
  <v-menu location="bottom end">
    <template #activator="{ props: menuProps }">
      <v-btn
        v-bind="{ ...menuProps, 'aria-label': `Actions for ${categoryName}` }"
        icon="mdi-dots-vertical"
        variant="text"
        :size="size ?? 'default'"
        density="comfortable"
        class="category-actions"
      />
    </template>
    <v-list density="compact" min-width="180" rounded="lg">
      <v-list-item prepend-icon="mdi-pencil-outline" title="Edit category" @click="$emit('edit')" />
      <v-list-item
        prepend-icon="mdi-trash-can-outline"
        title="Delete category"
        base-color="error"
        @click="$emit('delete')"
      />
    </v-list>
  </v-menu>
</template>

<style scoped>
.category-actions {
  color: rgba(var(--v-theme-on-surface), 0.55);
}
</style>
