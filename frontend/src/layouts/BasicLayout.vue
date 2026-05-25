<template>
  <div class="apple-dock-layout">
    <!-- Top System Menubar (Like macOS top bar) -->
    <header class="mac-sys-bar">
      <div class="sys-left">
        <span class="main-logo-icon"><icon-apps /></span>
        <span class="sys-bold">{{ $t('system.name') }}</span>
      </div>

      <div class="sys-right">
        <a-tooltip :content="$t('navbar.search')">
          <span class="tb-icon" @click="playClickSound"><icon-search /></span>
        </a-tooltip>
        <a-tooltip :content="$t('navbar.notification')">
          <span class="tb-icon" @click="playClickSound"><icon-notification /></span>
        </a-tooltip>
        
        <!-- Language Switcher -->
        <a-dropdown trigger="click" @select="handleLanguageChange">
          <span class="tb-icon" style="display: flex; align-items: center; gap: 4px;">
            <icon-language />
            <span style="font-size: 13px; font-weight: 500;">{{ locale === 'en-US' ? 'EN' : '简' }}</span>
          </span>
          <template #content>
            <a-doption value="zh-CN">简体中文</a-doption>
            <a-doption value="en-US">English</a-doption>
          </template>
        </a-dropdown>

        <a-dropdown trigger="click">
          <div class="user-block" @click="playClickSound">
            <span class="username">{{ authStore.username || $t('navbar.admin') }}</span>
          </div>
          <template #content>
            <a-doption v-if="authStore.roles.includes('SUPER_ADMIN') && authStore.tenantId !== '__SYSTEM__'" @click="handleReturnPlatform">
              <template #icon><icon-left /></template>
              返回平台管理
            </a-doption>
            <a-doption @click="handleLogout">
              <template #icon><icon-export /></template>
              {{ $t('navbar.logout') }}
            </a-doption>
          </template>
        </a-dropdown>
      </div>
    </header>

    <!-- SHEET页模式 / Safari-style Tabs Navigation -->
    <div class="mac-tabs-bar">
      <div 
        v-for="(tag, index) in visitedViews" 
        :key="tag.path"
        class="mac-tab"
        :class="{ 'active': route.path === tag.path }"
        @click="navigate(tag.path)"
      >
        <span class="tab-title">{{ getTitleByKey(tag.key) }}</span>
        <span class="tab-close" v-if="visitedViews.length > 1" @click.stop="closeTab(index)">
          <icon-close />
        </span>
      </div>
    </div>

    <!-- Main Workspace -->
    <main class="workspace-area">
      <div class="content-wrapper">
        <router-view v-slot="{ Component }">
          <transition name="fade-blur" mode="out-in">
            <keep-alive>
              <component :is="Component" />
            </keep-alive>
          </transition>
        </router-view>
      </div>
    </main>

    <!-- The MacOS Style Floating Dock -->
    <div class="dock-wrapper">
      <div class="apple-dock">
        <template v-for="item in visibleMenus" :key="item.key">
          
          <!-- Dropdown for Folder/Submenu (Custom Apple Folder Style) -->
          <a-dropdown v-if="item.children && item.children.length" position="top" trigger="hover">
            <button
              class="dock-item"
              :class="{ 'active': isSelected(item) }"
              @mouseenter="playClickSound"
            >
              <div class="dock-icon-box" :style="{ background: getTheme(item.key).gradient }">
                <component :is="getIcon(item.icon)" class="d-icon" :style="{ color: getTheme(item.key).color }" />
              </div>
              <span class="dock-tooltip">{{ getTitle(item) }}</span>
              <div class="active-dot" v-if="isSelected(item)"></div>
            </button>
            
            <!-- Ultra-clean Mac Context Menu Style -->
            <template #content>
              <div class="mac-context-menu">
                <div
                  v-for="child in getVisibleChildren(item)"
                  :key="child.key"
                  @click="navigate(child.path); hideDropdown()"
                  class="mac-context-item"
                  @mouseenter="playClickSound"
                >
                  <div class="c-item-icon-mini">
                    <component :is="getIcon(child.icon)" />
                  </div>
                  <span class="c-item-name">{{ getTitle(child) }}</span>
                </div>
              </div>
            </template>
          </a-dropdown>

          <!-- Simple App Icon -->
          <button
            v-else
            class="dock-item"
            :class="{ 'active': isSelected(item) }"
            @click="navigate(item.path)"
            @mouseenter="playClickSound"
          >
            <div class="dock-icon-box" :style="{ background: getTheme(item.key).gradient }">
              <component :is="getIcon(item.icon)" class="d-icon" :style="{ color: getTheme(item.key).color }" />
            </div>
            <span class="dock-tooltip">{{ getTitle(item) }}</span>
            <div class="active-dot" v-if="isSelected(item)"></div>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore, type MenuNode } from '@/stores/auth'
import { uiAudio } from '@/utils/audio'
import {
  IconDashboard, IconApps, IconSettings, IconStorage,
  IconCheckCircle, IconBook, IconSwap, IconCalendar,
  IconTool, IconSearch, IconNotification, IconExport,
  IconUser, IconArchive, IconClose, IconTags,
  IconBranch, IconSync, IconEdit, IconCode,
  IconFile, IconInteraction, IconLoading, IconHistory,
  IconComputer, IconList, IconHome, IconScan,
  IconCommand, IconSafe, IconRecord, IconCloseCircle,
  IconSkin, IconThunderbolt, IconBulb, IconPublic,
  IconStamp, IconUserGroup, IconDriveFile, IconUndo,
  IconDoubleDown, IconDoubleUp, IconBarChart,
  IconMessage, IconDownload, IconRelation, IconLayout,
  IconSchedule, IconCommon, IconLanguage
} from '@arco-design/web-vue/es/icon'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const iconMap: Record<string, unknown> = {
  IconDashboard, IconApps, IconSettings, IconStorage,
  IconCheckCircle, IconBook, IconSwap, IconCalendar, 
  IconTool, IconSearch, IconNotification, IconExport,
  IconUser, IconArchive, IconClose, IconTags,
  IconBranch, IconSync, IconEdit, IconCode,
  IconFile, IconInteraction, IconLoading, IconHistory,
  IconComputer, IconList, IconHome, IconScan,
  IconCommand, IconSafe, IconRecord, IconCloseCircle,
  IconSkin, IconThunderbolt, IconBulb, IconPublic,
  IconStamp, IconUserGroup, IconDriveFile, IconUndo,
  IconDoubleDown, IconDoubleUp, IconBarChart,
  IconMessage, IconDownload, IconRelation, IconLayout,
  IconSchedule, IconCommon, IconLanguage
}

// 模块色彩映射 - 为不同业务模块提供独特的视觉标识
const themeMap: Record<string, { gradient: string, color: string }> = {
  'dashboard': { gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' },
  'plm': { gradient: 'linear-gradient(135deg, #2dd4bf, #0d9488)', color: '#fff' },
  'mes': { gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' },
  'wms': { gradient: 'linear-gradient(135deg, #10b981, #047857)', color: '#fff' },
  'qms': { gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' },
  'erp': { gradient: 'linear-gradient(135deg, #6366f1, #4338ca)', color: '#fff' },
  'scm': { gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', color: '#fff' },
  'aps': { gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff' },
  'eam': { gradient: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff' },
  'traceability': { gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' },
  'traceability-full': { gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' },
  'hr': { gradient: 'linear-gradient(135deg, #a855f7, #9333ea)', color: '#fff' },
  'outsourcing': { gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: '#fff' },
  'mes-auto': { gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff' },
  'base': { gradient: 'linear-gradient(135deg, #64748b, #475569)', color: '#fff' },
  'sys': { gradient: 'linear-gradient(135deg, #4b5563, #1f2937)', color: '#fff' },
}

function getIcon(name?: string) {
  return name && iconMap[name] ? iconMap[name] : IconApps
}

function getTheme(key: string) {
  return themeMap[key] || { gradient: 'linear-gradient(135deg, #f0f0f0, #e0e0e0)', color: '#3b82f6' }
}

// 后端已按 enabledModules + 权限过滤菜单，前端直接使用
const visibleMenus = computed(() => authStore.menus)

function getVisibleChildren(item: MenuNode): MenuNode[] {
  return item.children || []
}

function isSelected(item: MenuNode): boolean {
  const currentPath = route.path
  if (item.path === currentPath) return true
  if (item.children) {
    return item.children.some(child => child.path === currentPath)
  }
  return false
}

let lastAudioTime = 0
function playClickSound() {
  const now = Date.now()
  if (now - lastAudioTime > 50) { 
    uiAudio.playClick()
    lastAudioTime = now
  }
}

function navigate(path?: string) {
  playClickSound()
  if (path && route.path !== path) {
    router.push(path)
  }
}

function hideDropdown() {
  // Hack to force click-away on custom elements
  document.body.click()
}

function handleLogout() {
  playClickSound()
  authStore.logout()
  router.push('/login')
}

async function handleReturnPlatform() {
  playClickSound()
  await authStore.switchTenant('__SYSTEM__')
}

const { t, locale } = useI18n()

function handleLanguageChange(val: any) {
  locale.value = val
  localStorage.setItem('user-language', val)
  playClickSound()
}

function getTitle(item: MenuNode) {
  const key = `menu.${item.key}`
  const translated = t(key)
  return translated === key ? item.title : translated
}

// === SHEET MODE (Tabs) LOGIC ===
interface TabView {
  key: string
  path: string
}
const visitedViews = ref<TabView[]>([])

function getTitleByKey(key: string) {
  const tKey = `menu.${key}`
  const translated = t(tKey)
  return translated === tKey ? key : translated
}

function getPageInfo(targetPath: string): { title: string, key: string } {
  for (const item of authStore.menus) {
    if (item.path === targetPath) return { title: item.title, key: item.key }
    if (item.children) {
      const child = item.children.find((c) => c.path === targetPath)
      if (child) return { title: child.title, key: child.key }
    }
  }
  return { title: '', key: 'dashboard' } // Fallback
}

watch(
  () => route.path,
  (newPath) => {
    if (!newPath || newPath === '/login') return
    const exists = visitedViews.value.some(v => v.path === newPath)
    if (!exists) {
      const info = getPageInfo(newPath)
      visitedViews.value.push({ path: newPath, key: info.key })
    }
  },
  { immediate: true }
)

function closeTab(index: number) {
  playClickSound()
  const isCurrent = visitedViews.value[index].path === route.path
  visitedViews.value.splice(index, 1)
  
  if (isCurrent) {
    if (visitedViews.value.length > 0) {
      router.push(visitedViews.value[visitedViews.value.length - 1].path)
    } else {
      router.push('/')
    }
  }
}
</script>

<style scoped>
.apple-dock-layout {
  height: 100vh;
  width: 100vw;
  background-color: #f5f5f7;
  position: relative;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
}

/* 顶部系统状态栏 (Mac Style Menu Bar) */
.mac-sys-bar {
  height: 32px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  font-size: 13px;
  font-weight: 500;
  color: #1d1d1f;
  z-index: 100;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  flex-shrink: 0;
}

.sys-left, .sys-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.main-logo-icon {
  font-size: 16px;
  cursor: pointer;
  color: #3b82f6;
}

.sys-bold {
  font-weight: 700;
  margin-right: 8px;
  cursor: pointer;
}

.tb-icon {
  font-size: 16px;
  display: flex;
  cursor: pointer;
}

.user-block {
  cursor: pointer;
  display: flex;
  align-items: center;
}

/* SHEET 页签栏 (Safari Style Tabs) */
.mac-tabs-bar {
  height: 38px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  align-items: flex-end;
  padding: 0 16px;
  gap: 2px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 4px rgba(0,0,0,0.01);
  z-index: 90;
  flex-shrink: 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.mac-tabs-bar::-webkit-scrollbar { display: none; }

.mac-tab {
  height: 30px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 8px 8px 0 0;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  border-bottom: none;
  font-size: 13px;
  color: #515154;
  transition: all 0.2s;
  white-space: nowrap;
}
.mac-tab.active {
  background: #f5f5f7;
  color: #1d1d1f;
  font-weight: 500;
  border-color: rgba(0,0,0,0.05);
  box-shadow: 0 -2px 5px rgba(0,0,0,0.02);
}
.mac-tab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.6);
}
.tab-close {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
.tab-close:hover {
  background: rgba(0,0,0,0.1);
  color: #000;
}

/* 中间主工作区 */
.workspace-area {
  flex: 1;
  position: relative;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 24px 24px 100px; /* 底部留出100px给Dock栏 */
}
.workspace-area::-webkit-scrollbar { width: 6px; }
.workspace-area::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }

.content-wrapper {
  max-width: 1440px;
  margin: 0 auto;
  min-height: 100%;
}

.fade-blur-enter-active,
.fade-blur-leave-active {
  transition: opacity 0.25s ease, filter 0.25s ease;
}
.fade-blur-enter-from,
.fade-blur-leave-to {
  opacity: 0; filter: blur(4px);
}

/* ==== APPLE DOCK 核心样式 ==== */
.dock-wrapper {
  position: fixed;
  bottom: 12px;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  z-index: 999;
  pointer-events: none; /* 让外壳不拦截事件 */
}

.apple-dock {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  background: rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 32px;
  padding: 8px 12px 6px; /* 增加顶部 padding 给放大预留空间 */
  box-shadow: 
    0 10px 30px rgba(0,0,0,0.1),
    inset 0 1px 1px rgba(255,255,255,0.8);
  max-width: 95vw;
  overflow: visible; /* 必须 visible，允许图标跃出 */
}
.apple-dock::-webkit-scrollbar { display: none; } /* 隐藏滚动条但能滑 */

.dock-item {
  position: relative;
  background: transparent;
  border: none;
  width: 56px;
  height: 64px; /* 增加高度限制 */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  cursor: pointer;
  padding: 0;
  margin: 0 4px;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  outline: none;
}

.dock-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 4px 8px rgba(0,0,0,0.12), 
    inset 0 1px 1px rgba(255,255,255,0.3);
  transition: transform 0.2s cubic-bezier(0.3, 1.5, 0.4, 1);
  margin-bottom: 6px;
  border: 1px solid rgba(255,255,255,0.2);
}

.dock-icon-box.bg-gray {
  background: linear-gradient(135deg, #6b7280, #4b5563);
}
.dock-icon-box.bg-gray .d-icon { color: #fff; }

.d-icon {
  font-size: 24px;
  color: #3b82f6;
}

/* Hover 特效：图标放大跃起 */
.dock-item:hover .dock-icon-box {
  transform: scale(1.3) translateY(-10px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.15), inset 0 2px 2px rgba(255,255,255,0.9);
}

/* Tooltip 小黑条（悬停时上方显示） */
.dock-tooltip {
  position: absolute;
  top: -38px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  color: white;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
/* 小箭头 */
.dock-tooltip::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 4px 5px 0 5px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.6) transparent transparent transparent;
}
.dock-item:hover .dock-tooltip {
  opacity: 1;
  transform: translateY(0);
}

/* 激活的小黑点 */
.active-dot {
  position: absolute;
  bottom: 0px;
  width: 4px;
  height: 4px;
  background: #1d1d1f;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

/* 细长的分隔符 */
.dock-divider {
  width: 1px;
  height: 40px;
  background: rgba(0, 0, 0, 0.15);
  margin: 0 8px;
}

/* 二级菜单：Mac 极简原生右键菜单风格 (Context Menu) */
:deep(.arco-dropdown) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(40px) saturate(200%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(200%) !important;
  border-radius: 12px !important;
  border: 1px solid rgba(255,255,255,0.6) !important;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.02) !important;
  padding: 6px !important;
  overflow: hidden;
}

.mac-context-menu {
  display: flex;
  flex-direction: column;
  min-width: 140px;
  max-width: 240px;
  max-height: 50vh;
  overflow-y: auto;
}
.mac-context-menu::-webkit-scrollbar { display: none; }

.mac-context-item {
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
  transition: all 0.1s ease;
  margin-bottom: 1px;
}
.mac-context-item:hover {
  background: #007aff;
  color: #ffffff;
  box-shadow: 0 4px 12px rgba(0,122,255,0.3);
}

.c-item-icon-mini {
  font-size: 16px;
  display: flex;
  opacity: 0.8;
}
.mac-context-item:hover .c-item-icon-mini {
  opacity: 1;
}
</style>
