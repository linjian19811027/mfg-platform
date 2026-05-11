import { createApp } from 'vue'
import ArcoVue from '@arco-design/web-vue'
import ArcoVueIcon from '@arco-design/web-vue/es/icon'
import '@arco-design/web-vue/dist/arco.css'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import { useAuthStore } from './stores/auth'
import i18n from './locale'

const app = createApp(App)
app.use(ArcoVue)
app.use(ArcoVueIcon)
app.use(createPinia())
app.use(i18n)

// pinia 挂载后恢复登录状态
useAuthStore().initFromStorage()

app.use(router)
app.mount('#app')
