import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './style.css'
import App from './App.vue'
import router from './router'
import axios from 'axios'
import { getApiBase } from './api/config'

// 与 ApiPaths（相对路径）拼接：基址须含 /api/v1，勿只写到 :8001
axios.defaults.baseURL = getApiBase().replace(/\/+$/, '')
// 配置数组参数序列化：将 regional_managers[]=a&regional_managers[]=b 转换为 regional_managers=a&regional_managers=b
axios.defaults.paramsSerializer = {
  indexes: null,
}

createApp(App).use(router).mount('#app')