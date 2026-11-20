<script setup lang="ts">
/**
 * One row of a list as its own card, like the rows in Windows Settings: an optional
 * `prepend` (icon, rank), the content and the actions (`append`) on the right. Rows go into
 * a ListSection, which stacks them. With `clickable`, the whole row opens something (click
 * or Enter) and shows a hover tint and a focus ring; clicks in the actions don't.
 */
const props = defineProps<{
  clickable?: boolean
}>()

const emit = defineEmits<{
  open: []
}>()

function open(): void {
  if (props.clickable) emit('open')
}
</script>

<template>
  <div
    class="list-row"
    :class="{ 'list-row--clickable': clickable }"
    :role="clickable ? 'button' : undefined"
    :tabindex="clickable ? 0 : undefined"
    @click="open"
    @keydown.enter.self="open"
  >
    <div v-if="$slots.prepend" class="list-row__side">
      <slot name="prepend" />
    </div>
    <div class="list-row__content">
      <slot />
    </div>
    <div v-if="$slots.append" class="list-row__side" @click.stop @keydown.stop>
      <slot name="append" />
    </div>
  </div>
</template>

<style scoped>
.list-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 12px 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  background: rgb(var(--v-theme-surface));
}

.list-row--clickable {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

/* Vuetify's hover tint over the card colour. */
.list-row--clickable:hover {
  background:
    linear-gradient(
      rgba(var(--v-theme-on-surface), var(--v-hover-opacity)),
      rgba(var(--v-theme-on-surface), var(--v-hover-opacity))
    ),
    rgb(var(--v-theme-surface));
}

.list-row--clickable:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: -2px;
}

.list-row__side {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 16px;
}

.list-row__content {
  flex: 1 1 240px;
  min-width: 0;
}
</style>
