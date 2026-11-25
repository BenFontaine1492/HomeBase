<script setup lang="ts">
import { t } from '@/i18n'

/**
 * The category of a cost or an income entry, like the name of an object attribute:
 * pick a suggestion (the default list, then the categories used before) or type your own.
 */
defineProps<{
  suggestions: readonly string[]
}>()

const category = defineModel<string>({ required: true })
</script>

<template>
  <v-combobox
    :model-value="category"
    :items="[...suggestions]"
    :label="t('finances.category')"
    :hint="t('finances.categoryHint')"
    persistent-hint
    hide-no-data
    class="mb-2"
    @update:model-value="(value: string | null) => (category = value ?? '')"
  />
</template>
