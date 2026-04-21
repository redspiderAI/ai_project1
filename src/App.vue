<template>
  <div class="integration-shell">
    <header class="top-nav">
      <div class="top-nav-inner">
        <div class="title-group">
          <h1 class="title">AI 综合业务门户</h1>
          <p class="subtitle">将业务页面统一到同一个网页入口</p>
        </div>
        <div class="module-tabs">
          <button
            v-for="item in primaryTabs"
            :key="item.key"
            class="tab-btn tab-btn-primary"
            :class="{ active: activeSection === item.key }"
            type="button"
            @click="activeSection = item.key"
          >
            {{ item.label }}
          </button>
        </div>
        <div class="auth-tools">
          <button v-if="!isLoggedIn" class="auth-btn auth-btn-login" type="button" @click="showLogin = true">
            <i class="bi bi-box-arrow-in-right"></i>
            登录
          </button>
          <template v-else>
            <button class="auth-btn auth-btn-user" type="button" @click="openUserManage">
              <i class="bi bi-people"></i>
              用户管理
            </button>
            <button class="auth-btn auth-btn-logout" type="button" @click="logoutNow">
              <i class="bi bi-box-arrow-right"></i>
              退出
            </button>
          </template>
        </div>
      </div>
    </header>

    <nav v-if="activeSection === 'prediction'" class="sub-nav" aria-label="AI 预测子模块">
      <div class="sub-nav-inner">
        <button
          v-for="item in predictionSubTabs"
          :key="item.key"
          class="sub-tab-btn"
          :class="{ active: predictionSubTab === item.key }"
          type="button"
          @click="predictionSubTab = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </nav>

    <main class="page-main" :class="{ 'has-sub-nav': activeSection === 'prediction' }">
      <section v-if="activeSection === 'prediction' && predictionSubTab === 'historyManage'" class="panel inner-page">
        <HistoryManage />
      </section>
      <section v-else-if="activeSection === 'prediction' && predictionSubTab === 'historyQuery'" class="panel inner-page">
        <HistoryQuery />
      </section>
      <section v-else-if="activeSection === 'prediction' && predictionSubTab === 'forecast'" class="panel inner-page">
        <PurchaseQuantity />
      </section>
      <section v-else-if="activeSection === 'map'" class="panel emap-panel">
        <ElectronicMap />
      </section>
      <section v-else-if="activeSection === 'users'" class="panel inner-page">
        <UserManage />
      </section>
      <section v-else class="panel iframe-panel">
        <iframe
          class="embedded-frame"
          :src="embeddedIframeSrc"
          :title="activeFrameTitle"
        />
      </section>
    </main>

    <div v-if="showLogin" class="login-mask">
      <div class="card login-card">
        <div class="card-body">
          <h6 class="mb-3">用户登录</h6>
          <div class="mb-2">
            <label class="form-label">用户名</label>
            <input v-model.trim="loginForm.username" class="form-control form-control-sm" />
          </div>
          <div class="mb-2">
            <label class="form-label">密码</label>
            <input v-model.trim="loginForm.password" type="password" class="form-control form-control-sm" />
          </div>
          <div v-if="loginError" class="alert alert-warning py-2 mb-2">{{ loginError }}</div>
          <div class="login-actions">
            <button class="btn btn-sm btn-secondary" type="button" @click="showLogin = false">取消</button>
            <button class="btn btn-sm btn-primary" type="button" :disabled="loginLoading" @click="submitLogin">
              {{ loginLoading ? '登录中…' : '登录' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HistoryManage from './pages/HistoryManage.vue'
import HistoryQuery from './pages/HistoryQuery.vue'
import PurchaseQuantity from './pages/PurchaseQuantity.vue'
import ElectronicMap from './pages/ElectronicMap.vue'
import UserManage from './pages/UserManage.vue'
import { clearToken, getToken, login } from './api/authApi'

type SectionKey = 'prediction' | 'map' | 'detect' | 'price' | 'users'
type PredictionSubKey = 'historyManage' | 'historyQuery' | 'forecast'

const primaryTabs: Array<{ key: SectionKey; label: string }> = [
  { key: 'map', label: '电子地图' },
  { key: 'prediction', label: 'AI 预测' },
  { key: 'detect', label: '图片真伪检查' },
  { key: 'price', label: 'AI 比价系统' },
]

const predictionSubTabs: Array<{ key: PredictionSubKey; label: string }> = [
  { key: 'historyManage', label: '历史数据管理' },
  { key: 'historyQuery', label: '历史数据查询' },
  { key: 'forecast', label: '送货量预测' },
]

const activeSection = ref<SectionKey>('map')
const predictionSubTab = ref<PredictionSubKey>('historyManage')
const baseUrl = import.meta.env.BASE_URL
const isLoggedIn = ref(!!getToken())
const showLogin = ref(false)
const loginLoading = ref(false)
const loginError = ref('')
const loginForm = ref({ username: '', password: '' })

function embeddedBasePath(section: 'detect' | 'price') {
  if (section === 'detect') return `${baseUrl}embedded/ai_test/index.html`
  return `${baseUrl}embedded/price_system/index.html`
}

/** 嵌入门户：带 embed=1，子页面可隐藏自带顶栏，避免「页中页」 */
const embeddedIframeSrc = computed(() => {
  const s = activeSection.value
  if (s !== 'detect' && s !== 'price') return 'about:blank'
  const path = embeddedBasePath(s)
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}embed=1`
})

const activeFrameTitle = computed(() => {
  if (activeSection.value === 'detect') return '图像真伪检测系统'
  return 'AI 智能比价系统'
})

function openUserManage() {
  activeSection.value = 'users'
}

function logoutNow() {
  clearToken()
  isLoggedIn.value = false
  if (activeSection.value === 'users') activeSection.value = 'map'
}

async function submitLogin() {
  if (!loginForm.value.username || !loginForm.value.password) {
    loginError.value = '请输入用户名和密码'
    return
  }
  loginLoading.value = true
  loginError.value = ''
  try {
    await login(loginForm.value.username, loginForm.value.password)
    isLoggedIn.value = true
    showLogin.value = false
    activeSection.value = 'users'
  } catch (e) {
    loginError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loginLoading.value = false
  }
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  background-color: #f5f7fa;
}

.integration-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.top-nav {
  background-color: #196cc0;
  position: sticky;
  top: 0;
  z-index: 1100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.top-nav-inner {
  max-width: 100%;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 72px;
  flex-wrap: nowrap;
}

.auth-tools {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  padding: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.auth-btn {
  border: none;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.auth-btn i {
  font-size: 14px;
}

.auth-btn-user {
  color: #0f172a;
  background: #ffffff;
}

.auth-btn-user:hover {
  background: #f8fafc;
  transform: translateY(-1px);
}

.auth-btn-logout {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.36);
}

.auth-btn-logout:hover {
  background: rgba(255, 255, 255, 0.24);
}

.auth-btn-login {
  color: #0f172a;
  background: #ffffff;
}

.auth-btn-login:hover {
  background: #f8fafc;
  transform: translateY(-1px);
}

.title-group {
  padding: 10px 0;
}

.title {
  color: white;
  font-size: 20px;
  font-weight: 700;
}

.subtitle {
  margin-top: 4px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
}

.module-tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  margin: 10px 0;
  max-width: 100%;
  overflow-x: auto;
}

.tab-btn {
  border: none;
  padding: 0 18px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
}

.tab-btn-primary {
  padding: 0 22px;
  font-weight: 600;
}

.tab-btn:hover {
  color: white;
  background-color: rgba(255, 255, 255, 0.2);
}

.tab-btn.active {
  color: #196cc0;
  background-color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sub-nav {
  position: sticky;
  top: 72px;
  z-index: 1050;
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.sub-nav-inner {
  max-width: 1600px;
  margin: 0 auto;
  padding: 8px 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.sub-tab-btn {
  border: 1px solid transparent;
  padding: 0 16px;
  height: 34px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  color: #4b5563;
  background: #f3f4f6;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.sub-tab-btn:hover {
  background: #e5e7eb;
  color: #111827;
}

.sub-tab-btn.active {
  color: #196cc0;
  background: rgba(25, 108, 192, 0.1);
  border-color: rgba(25, 108, 192, 0.35);
}

.page-main {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel {
  width: 100%;
}

.inner-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.iframe-panel {
  flex: 1;
  min-height: 0;
  height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  background: #fff;
}

.emap-panel {
  flex: 1;
  min-height: 0;
  height: calc(100vh - 72px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f3f4f6;
}

.page-main.has-sub-nav .iframe-panel {
  height: calc(100vh - 72px - 51px);
}


.embedded-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: none;
  border-radius: 0;
  margin: 0;
  display: block;
  background: #fff;
}

.login-mask {
  position: fixed;
  inset: 0;
  z-index: 1300;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.login-card {
  width: min(420px, 100%);
}

.login-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
