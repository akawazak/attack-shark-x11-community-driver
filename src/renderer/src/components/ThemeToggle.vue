<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Sun, Moon } from 'lucide-vue-next'

const isLight = ref(false)

const toggleTheme = () => {
  isLight.value = !isLight.value
  document.documentElement.classList.toggle('light', isLight.value)
  localStorage.setItem('theme', isLight.value ? 'light' : 'dark')
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme === 'light') {
    isLight.value = true
    document.documentElement.classList.add('light')
  }
})

watch(isLight, (val) => {
  document.documentElement.classList.toggle('light', val)
})
</script>

<template>
  <button
    @click="toggleTheme"
    class="p-2 rounded-lg transition-all hover:bg-[var(--surface-hover)]"
    :title="isLight ? 'Switch to dark mode' : 'Switch to light mode'"
  >
    <Sun v-if="isLight" class="w-5 h-5 text-amber-500" />
    <Moon v-else class="w-5 h-5 text-slate-400" />
  </button>
</template>
