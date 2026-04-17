<template>
  <div v-if="totalPages > 0" class="page-nav">
    <button class="btn" :disabled="currentPage <= 1" @click="$emit('prev')">‹ 上一页</button>
    <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
    <button class="btn" :disabled="currentPage >= totalPages" @click="$emit('next')">下一页 ›</button>
  </div>
</template>

<script setup>
defineProps({
  currentPage: Number,
  totalPages: Number,
})

defineEmits(['prev', 'next'])
</script>

<style scoped>
.page-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 6px 14px;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  border-color: #4a90d9;
  color: #4a90d9;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #555;
  min-width: 60px;
  text-align: center;
}
</style>
