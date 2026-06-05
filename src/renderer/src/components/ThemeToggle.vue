<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Moon, Sun, Coffee } from 'lucide-vue-next'

type Theme = 'dark' | 'light' | 'cappuccino'
const themes: Theme[] = ['dark', 'light', 'cappuccino']
const themeIndex = ref(0)

const themeClasses: Record<Theme, string> = {
  dark: 'text-[var(--sidebar-text)]',
  light: 'text-amber-500',
  cappuccino: 'text-[var(--shark-primary)]',
}

const themeIcons: Record<Theme, any> = {
  dark: Moon,
  light: Sun,
  cappuccino: Coffee,
}

const toggleTheme = () => {
  themeIndex.value = (themeIndex.value + 1) % themes.length
  const theme = themes[themeIndex.value]
  document.documentElement.className = theme === 'dark' ? '' : theme
  localStorage.setItem('theme', theme)
}

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as Theme | null
  if (savedTheme && themes.includes(savedTheme)) {
    themeIndex.value = themes.indexOf(savedTheme)
    document.documentElement.className = savedTheme === 'dark' ? '' : savedTheme
  }
})
</script>

<template>
  <button
    @click="toggleTheme"
    class="p-2 rounded-lg transition-all hover:bg-[var(--sidebar-hover)]"
    :title="'Switch to ' + themes[(themeIndex + 1) % themes.length]"
  >
    <component :is="themeIcons[themes[themeIndex]]" :class="['w-5 h-5', themeClasses[themes[themeIndex]]]" />
  </button>
</template>
