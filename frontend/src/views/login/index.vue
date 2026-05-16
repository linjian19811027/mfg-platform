<template>
  <div class="apple-login">
    <!-- Abstract soft background -->
    <div class="mac-bg">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>

    <!-- Login Container Box -->
    <div class="mac-window">
      <div class="content-body">
        <div class="logo-box">
          <icon-apps />
        </div>
        <h1 class="l-title">{{ $t('login.title') }}</h1>
        <p class="l-desc">Manufacturing OS</p>

        <a-form :model="form" layout="vertical" @submit="handleLogin" class="mac-form">
          <a-form-item>
            <a-input
              v-model="form.username"
              :placeholder="$t('login.username')"
              size="large"
              allow-clear
              class="mac-input"
              @focus="playClick"
            >
              <template #prefix><IconUser style="color: #8e8e93;"/></template>
            </a-input>
          </a-form-item>

          <a-form-item>
            <a-input-password
              v-model="form.password"
              :placeholder="$t('login.password')"
              size="large"
              class="mac-input"
              @focus="playClick"
            >
              <template #prefix><IconLock style="color: #8e8e93;"/></template>
            </a-input-password>
          </a-form-item>

          <a-form-item>
            <a-input
              v-model="form.tenantCode"
              :placeholder="$t('login.tenant')"
              size="large"
              allow-clear
              class="mac-input"
              @focus="playClick"
            >
              <template #prefix><icon-apps style="color: #8e8e93;"/></template>
            </a-input>
          </a-form-item>

          <div class="login-actions">
            <a-checkbox v-model="rememberMe" @change="playClick">{{ $t('login.remember') }}</a-checkbox>
            <a class="forgot" @click="playClick">{{ $t('login.forgot') }}</a>
          </div>

          <a-button type="primary" html-type="submit" :loading="loading" class="mac-btn" long size="large" @mouseover="playClick">
            {{ $t('login.submit') }}
          </a-button>
          
          <div class="lang-switch-login">
            <a-radio-group v-model="currentLocale" type="button" size="mini" @change="handleLocaleChange">
              <a-radio value="zh-CN">{{ $t('common.misc.zh') }}</a-radio>
              <a-radio value="en-US">EN</a-radio>
            </a-radio-group>
          </div>
        </a-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Message } from '@arco-design/web-vue'
import { IconUser, IconLock, IconApps } from '@arco-design/web-vue/es/icon'
import { useAuthStore } from '@/stores/auth'
import { uiAudio } from '@/utils/audio'

const router = useRouter()
const authStore = useAuthStore()

const form = ref({ username: '', password: '', tenantCode: 'DEFAULT' })
const rememberMe = ref(false)
const loading = ref(false)

const { locale, t } = useI18n()
const currentLocale = ref(locale.value)

function handleLocaleChange(val: any) {
  locale.value = val
  localStorage.setItem('user-language', val)
  playClick()
}

onMounted(() => {
  const saved = localStorage.getItem('remembered_username')
  if (saved) {
    form.value.username = saved
    rememberMe.value = true
  }
})

function playClick() {
  uiAudio.playClick()
}

async function handleLogin() {
  playClick()
  if (!form.value.username || !form.value.password) {
    Message.error(t('login.error'))
    return
  }
  loading.value = true
  try {
    await authStore.login(form.value.username, form.value.password, form.value.tenantCode || 'DEFAULT')
    if (rememberMe.value) {
      localStorage.setItem('remembered_username', form.value.username)
    } else {
      localStorage.removeItem('remembered_username')
    }
    uiAudio.playSuccess() // Play Apple-style pleasant success sound
    setTimeout(() => {
      router.push('/')
    }, 400) // slight delay to hear the sound
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Access Denied'
    Message.error(msg)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.apple-login {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f7; /* Classic Apple light grey */
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
}

.mac-bg {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  z-index: 0;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.8) 0%, rgba(245, 245, 247, 1) 100%);
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  opacity: 0.6;
}
.blob-1 {
  width: 600px; height: 600px;
  background: #bfdbfe;
  bottom: -200px; left: -200px;
  animation: drift 20s infinite alternate;
}
.blob-2 {
  width: 500px; height: 500px;
  background: #ddd6fe;
  top: -150px; right: -150px;
  animation: drift 15s infinite alternate-reverse;
}

@keyframes drift {
  100% { transform: translate(50px, 50px); }
}

.mac-window {
  position: relative;
  z-index: 10;
  width: 400px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.content-body {
  padding: 40px 40px 40px;
  text-align: center;
}

.logo-box {
  width: 64px; height: 64px;
  margin: 0 auto 16px;
  background: #007aff;
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 32px;
  box-shadow: 0 8px 24px rgba(0, 122, 255, 0.3);
}

.l-title {
  font-size: 22px; font-weight: 600; color: #1c1c1e; margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.l-desc {
  font-size: 13px; color: #8e8e93; margin: 0 0 24px;
}

.mac-form :deep(.arco-form-item) {
  margin-bottom: 16px;
}

:deep(.arco-input-wrapper) {
  background: rgba(255, 255, 255, 0.6) !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: 10px !important;
  padding-left: 12px;
  color: #1c1c1e;
  transition: all 0.2s;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}
:deep(.arco-input-wrapper:hover), :deep(.arco-input-wrapper.arco-input-focus) {
  background: #ffffff !important;
  border-color: #007aff !important;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15) !important;
}
:deep(.arco-input) { color: #1c1c1e; font-size: 15px; }

.login-actions {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 24px; font-size: 13px;
}

:deep(.arco-checkbox-label) { color: #3a3a3c; }
.forgot { color: #007aff; cursor: pointer; transition: opacity 0.2s; }
.forgot:hover { opacity: 0.8; }

.mac-btn {
  background: #007aff;
  border: none;
  border-radius: 10px;
  height: 44px;
  font-size: 16px; font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
  transition: all 0.2s;
  letter-spacing: -0.2px;
}
.mac-btn:hover {
  background: #006ce6;
  transform: scale(0.99);
}
.mac-btn:active {
  transform: scale(0.97);
}

.lang-switch-login {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
