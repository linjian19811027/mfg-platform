<template>
  <a-config-provider :locale="arcoLocale">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import zhCN from '@arco-design/web-vue/es/locale/lang/zh-cn';
import enUS from '@arco-design/web-vue/es/locale/lang/en-us';

const { locale } = useI18n();

const arcoLocale = computed(() => {
  switch (locale.value) {
    case 'zh-CN':
      return zhCN;
    case 'en-US':
      return enUS;
    default:
      return zhCN;
  }
});
</script>

<style>
:root {
  --color-primary-6: #1B4FD8;
  --color-primary-5: #2563EB;
  --color-primary-7: #1E40AF;
  --color-success-6: #00B578;
  --color-warning-6: #FF6B35;
  --color-danger-6: #F53F3F;
  --color-bg-1: #0D1117;
  --color-bg-2: #161B22;
  --color-bg-3: #21262D;
  --color-text-1: #E6EDF3;
  --color-text-2: #8B949E;
  --color-border: #21262D;
  --border-radius-medium: 6px;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--color-bg-1);
  color: var(--color-text-1);
  font-family: Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
