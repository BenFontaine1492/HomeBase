<script setup lang="ts">
import BackupRestoreCard from '@/components/settings/BackupRestoreCard.vue'
import ExportImportCard from '@/components/settings/ExportImportCard.vue'
</script>

<template>
  <div class="settings-data">
    <BackupRestoreCard />
    <ExportImportCard />
  </div>
</template>

<style scoped>
.settings-data {
  display: grid;
  gap: 24px;
}
</style>
