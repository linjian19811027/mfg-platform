<template>
  <div class="error-page">
    <div class="error-content">
      <div class="error-code">404</div>
      <div class="error-icon">
        <icon-file :size="64" />
      </div>
      <h2 class="error-title">页面不存在</h2>
      <p class="error-desc">您访问的页面不存在或已被移除</p>
      <a-button type="primary" @click="$router.push('/dashboard')">返回首页</a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.error-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--color-bg-1);
}
.error-content { text-align: center; }
.error-code { font-size: 96px; font-weight: 700; color: var(--color-primary-light-4); line-height: 1; margin-bottom: 16px; }
.error-icon { color: var(--color-text-3); margin-bottom: 16px; }
.error-title { font-size: 24px; color: var(--color-text-1); margin: 0 0 8px; }
.error-desc { font-size: 14px; color: var(--color-text-3); margin: 0 0 24px; }
</style>
