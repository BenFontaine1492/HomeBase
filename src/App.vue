<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
</script>

<template>
  <v-app>
    <AppSidebar />
    <v-main>
      <div class="page-container">
        <router-view />
      </div>
    </v-main>
  </v-app>
</template>
