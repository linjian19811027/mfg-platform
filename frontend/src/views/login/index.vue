<template>
  <div class="login-page">
    <!-- Animated background -->
    <div class="bg-layer">
      <div class="mesh-gradient"></div>
      <div class="float-shape shape-1"></div>
      <div class="float-shape shape-2"></div>
      <div class="float-shape shape-3"></div>
      <div class="float-shape shape-4"></div>
      <div class="float-shape shape-5"></div>
    </div>

    <!-- Main content -->
    <div class="login-container">
      <!-- Left: Branding -->
      <div class="brand-panel">
        <div class="brand-content">
          <div class="brand-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor" opacity="0.9"/>
              <rect x="28" y="4" width="16" height="16" rx="3" fill="currentColor" opacity="0.6"/>
              <rect x="4" y="28" width="16" height="16" rx="3" fill="currentColor" opacity="0.6"/>
              <rect x="28" y="28" width="16" height="16" rx="3" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
          <h1 class="brand-title">MFG Platform</h1>
          <p class="brand-subtitle">{{ $t('login.brandSubtitle') || '制造业数字化运营平台' }}</p>
          <div class="brand-features">
            <div class="feature-item" v-for="(f, i) in features" :key="i">
              <div class="feature-dot"></div>
              <span>{{ f }}</span>
            </div>
          </div>
        </div>
        <div class="brand-footer">
          <span class="version-tag">v1.0.0</span>
        </div>
      </div>

      <!-- Right: Login Form -->
      <div class="form-panel">
        <div class="form-content">
          <div class="form-header">
            <h2 class="form-title">{{ $t('login.title') }}</h2>
            <p class="form-desc">{{ $t('login.formDesc') || '请输入您的账号信息' }}</p>
          </div>

          <a-form :model="form" layout="vertical" @submit="handleLogin" class="login-form">
            <a-form-item :label="$t('login.tenant')">
              <a-input
                v-model="form.tenantCode"
                placeholder="DEFAULT"
                size="large"
                allow-clear
                @focus="playClick"
              >
                <template #prefix><icon-apps class="input-icon" /></template>
              </a-input>
            </a-form-item>

            <a-form-item :label="$t('login.username')">
              <a-input
                v-model="form.username"
                :placeholder="$t('login.usernamePlaceholder') || '请输入用户名'"
                size="large"
                allow-clear
                @focus="playClick"
              >
                <template #prefix><IconUser class="input-icon" /></template>
              </a-input>
            </a-form-item>

            <a-form-item :label="$t('login.password')">
              <a-input-password
                v-model="form.password"
                :placeholder="$t('login.passwordPlaceholder') || '请输入密码'"
                size="large"
                @focus="playClick"
              >
                <template #prefix><IconLock class="input-icon" /></template>
              </a-input-password>
            </a-form-item>

            <div class="form-options">
              <a-checkbox v-model="rememberMe" @change="playClick">{{ $t('login.remember') }}</a-checkbox>
              <a class="forgot-link" @click="handleForgot">{{ $t('login.forgot') }}</a>
            </div>

            <a-button
              type="primary"
              html-type="submit"
              :loading="loading"
              class="login-btn"
              long
              size="large"
              @mouseover="playClick"
            >
              {{ loading ? ($t('login.logging') || '登录中...') : $t('login.submit') }}
            </a-button>

            <div class="lang-switch">
              <a-radio-group v-model="currentLocale" type="button" size="mini" @change="handleLocaleChange">
                <a-radio value="zh-CN">{{ $t('common.misc.zh') }}</a-radio>
                <a-radio value="en-US">EN</a-radio>
              </a-radio-group>
            </div>
          </a-form>
        </div>
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
const { locale, t } = useI18n()

const form = ref({ username: '', password: '', tenantCode: 'DEFAULT' })
const rememberMe = ref(false)
const loading = ref(false)
const currentLocale = ref(locale.value)

const features = [
  'PLM · MES · WMS · QMS',
  'SCM · ERP · APS · EAM',
  'HR · 追溯 · 外协',
]

function playClick() { uiAudio.playClick() }

function handleLocaleChange(val: any) {
  locale.value = val
  localStorage.setItem('user-language', val)
  playClick()
}

function handleForgot() {
  Message.info(t('login.forgotMsg') || '请联系系统管理员重置密码')
}

onMounted(() => {
  const saved = localStorage.getItem('remembered_username')
  if (saved) { form.value.username = saved; rememberMe.value = true }
})

async function handleLogin() {
  playClick()
  if (!form.value.username || !form.value.password) {
    Message.error(t('login.error') || '请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await authStore.login(form.value.username, form.value.password, form.value.tenantCode || 'DEFAULT')
    if (rememberMe.value) localStorage.setItem('remembered_username', form.value.username)
    else localStorage.removeItem('remembered_username')
    uiAudio.playSuccess()
    setTimeout(() => router.push('/'), 400)
  } catch (err: unknown) {
    Message.error(err instanceof Error ? err.message : (t('login.error') || '登录失败'))
  } finally { loading.value = false }
}
</script>

<style scoped>
/* ── Page ── */
.login-page {
  height: 100vh;
  width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  font-family: 'DM Sans', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f0f2ff;
}

/* ── Background ── */
.bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.mesh-gradient {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
  animation: meshShift 20s ease-in-out infinite alternate;
}

@keyframes meshShift {
  0% {
    background:
      radial-gradient(ellipse at 20% 50%, rgba(99, 102, 241, 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 60% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
  }
  100% {
    background:
      radial-gradient(ellipse at 40% 30%, rgba(99, 102, 241, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at 70% 60%, rgba(6, 182, 212, 0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 30% 70%, rgba(168, 85, 247, 0.1) 0%, transparent 50%);
  }
}

.float-shape {
  position: absolute;
  border-radius: 50%;
  opacity: 0.2;
}
.shape-1 {
  width: 350px; height: 350px;
  background: linear-gradient(135deg, #818cf8, #a78bfa);
  top: -80px; left: -60px;
  animation: drift1 30s ease-in-out infinite;
}
.shape-2 {
  width: 280px; height: 280px;
  background: linear-gradient(135deg, #22d3ee, #67e8f9);
  bottom: -60px; right: -40px;
  animation: drift2 25s ease-in-out infinite;
}
.shape-3 {
  width: 200px; height: 200px;
  background: linear-gradient(135deg, #c084fc, #e879f9);
  top: 40%; left: 60%;
  animation: drift3 35s ease-in-out infinite;
}
.shape-4 {
  width: 150px; height: 150px;
  background: linear-gradient(135deg, #60a5fa, #93c5fd);
  top: 10%; right: 20%;
  animation: drift1 28s ease-in-out infinite reverse;
}
.shape-5 {
  width: 120px; height: 120px;
  background: linear-gradient(135deg, #34d399, #6ee7b7);
  bottom: 20%; left: 15%;
  animation: drift2 32s ease-in-out infinite reverse;
}

@keyframes drift1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(40px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 25px) scale(0.95); }
}
@keyframes drift2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-35px, 20px) scale(1.03); }
  66% { transform: translate(25px, -15px) scale(0.97); }
}
@keyframes drift3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(20px, 35px) scale(1.04); }
  66% { transform: translate(-30px, -20px) scale(0.96); }
}

/* ── Container ── */
.login-container {
  position: relative;
  z-index: 10;
  display: flex;
  width: 920px;
  max-width: 95vw;
  min-height: 540px;
  border-radius: 24px;
  overflow: hidden;
  box-shadow:
    0 0 0 1px rgba(0,0,0,0.04),
    0 20px 60px rgba(99,102,241,0.12),
    0 0 0 1px rgba(255,255,255,0.6);
  animation: containerIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes containerIn {
  from { opacity: 0; transform: translateY(30px) scale(0.97); }
}

/* ── Brand Panel ── */
.brand-panel {
  width: 380px;
  background: linear-gradient(160deg, #4f46e5 0%, #6366f1 40%, #818cf8 100%);
  padding: 48px 36px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}

.brand-panel::before {
  content: '';
  position: absolute;
  top: -50%; right: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.12) 0%, transparent 60%);
  pointer-events: none;
}

.brand-icon {
  width: 64px; height: 64px;
  background: rgba(255,255,255,0.2);
  border: 1px solid rgba(255,255,255,0.3);
  border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  color: white;
  margin-bottom: 28px;
  backdrop-filter: blur(10px);
}

.brand-title {
  font-size: 28px; font-weight: 700; color: #fff;
  margin: 0 0 8px; letter-spacing: -0.5px;
}
.brand-subtitle {
  font-size: 14px; color: rgba(255,255,255,0.8);
  margin: 0 0 36px; line-height: 1.5;
}

.brand-features { display: flex; flex-direction: column; gap: 12px; }

.feature-item {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: rgba(255,255,255,0.9);
  opacity: 0;
  animation: fadeSlideIn 0.5s ease forwards;
}
.feature-item:nth-child(1) { animation-delay: 0.4s; }
.feature-item:nth-child(2) { animation-delay: 0.55s; }
.feature-item:nth-child(3) { animation-delay: 0.7s; }

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}

.feature-dot {
  width: 6px; height: 6px;
  background: rgba(255,255,255,0.8);
  border-radius: 50%; flex-shrink: 0;
}

.brand-footer { padding-top: 20px; }
.version-tag {
  font-size: 11px; color: rgba(255,255,255,0.5);
  background: rgba(255,255,255,0.1);
  padding: 3px 8px; border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}

/* ── Form Panel ── */
.form-panel {
  flex: 1;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
}

.form-content {
  width: 100%;
  max-width: 360px;
}

.form-header { margin-bottom: 32px; }

.form-title {
  font-size: 24px; font-weight: 700; color: #1e1b4b;
  margin: 0 0 6px; letter-spacing: -0.3px;
}
.form-desc { font-size: 14px; color: #6b7280; margin: 0; }

.login-form :deep(.arco-form-item) { margin-bottom: 20px; }

:deep(.arco-form-item-label) {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #374151 !important;
  margin-bottom: 6px !important;
  line-height: 1.4 !important;
  padding: 0 !important;
  height: auto !important;
}

:deep(.arco-input-wrapper) {
  background: #f9fafb !important;
  border: 1.5px solid #e5e7eb !important;
  border-radius: 10px !important;
  height: 44px;
  transition: all 0.2s ease;
}
:deep(.arco-input-wrapper:hover) {
  border-color: #c7d2fe !important;
  background: #fff !important;
}
:deep(.arco-input-wrapper.arco-input-focus) {
  border-color: #6366f1 !important;
  background: #fff !important;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12) !important;
}
:deep(.arco-input) { color: #1e1b4b !important; font-size: 14px; }
:deep(.arco-input::placeholder) { color: #9ca3af; }

.input-icon { color: #9ca3af; font-size: 16px; }

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-size: 13px;
}
:deep(.arco-checkbox-label) { color: #6b7280; font-size: 13px; }
.forgot-link {
  color: #6366f1; cursor: pointer; text-decoration: none; font-weight: 500;
}
.forgot-link:hover { text-decoration: underline; }

.login-btn {
  height: 46px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  border-radius: 10px !important;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important;
  border: none !important;
  box-shadow: 0 4px 14px rgba(99,102,241,0.35) !important;
  transition: all 0.2s ease !important;
  letter-spacing: 0.2px;
}
.login-btn:hover {
  box-shadow: 0 6px 20px rgba(99,102,241,0.45) !important;
  transform: translateY(-1px);
}
.login-btn:active {
  transform: translateY(0) !important;
  box-shadow: 0 2px 8px rgba(99,102,241,0.3) !important;
}

.lang-switch {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
:deep(.arco-radio-group-button) {
  border-radius: 8px !important;
  border: 1px solid #e5e7eb !important;
}
:deep(.arco-radio-button) {
  font-size: 12px !important;
  padding: 4px 14px !important;
}
</style>
