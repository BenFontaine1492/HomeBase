<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDashboard } from '@/composables/useDashboard'
import { WIDGET_TYPES } from '@/types/dashboard'
import { describeError } from '@/utils/error'

/** Picks a widget type and adds it at the end of the dashboard. */
const open = defineModel<boolean>({ required: true })

const { addWidget } = useDashboard()

const addingType = ref<string | null>(null)
const addError = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) addError.value = null
})

async function add(typeId: string): Promise<void> {
  if (addingType.value) return
  addingType.value = typeId
  addError.value = null
  try {
    await addWidget(typeId)
    open.value = false
  } catch (error) {
    console.error(error)
    addError.value = describeError(error)
  } finally {
    addingType.value = null
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="560" :persistent="addingType !== null">
    <v-card class="pa-2">
      <v-card-title class="text-title-large font-weight-bold pt-4 px-6">Add widget</v-card-title>
      <v-card-subtitle class="px-6">It is added at the end; drag it to where you want it.</v-card-subtitle>

      <v-list class="px-4 pt-4">
        <v-list-item
          v-for="type in WIDGET_TYPES"
          :key="type.id"
          :prepend-icon="type.icon"
          :title="type.title"
          :subtitle="type.description"
          :disabled="addingType !== null"
          rounded="lg"
          lines="two"
          @click="add(type.id)"
        >
          <template #append>
            <v-progress-circular v-if="addingType === type.id" indeterminate size="20" width="2" color="primary" />
            <v-icon v-else icon="mdi-plus" />
          </template>
        </v-list-item>
      </v-list>

      <v-alert v-if="addError" type="error" class="mx-6 mb-2" density="compact">{{ addError }}</v-alert>

      <v-card-actions class="px-6 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="addingType !== null" v-bind="{ onClick: () => (open = false) }">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
