import { createApp } from 'vue'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './style.css'
import App from './App.vue'
import router from './router'
import axios from 'axios'
import { getApiBase } from './api/config'

/**
 * AI 预测模块（HistoryManage / HistoryQuery / PurchaseQuantity）使用 `ApiPaths`：
 * 路径已为 `/delivery-history`、`/forecast/*` 等，不再套 `/api/v1`。
 * `getApiBase()` 若配置为 `…/api/v1` 或相对 `/api/v1`，此处去掉末尾段，避免拼成 `/api/v1/delivery-history`。
 */
function axiosApiBase(): string {
  return getApiBase().replace(/\/+$/, '').replace(/\/api\/v1$/i, '')
}
axios.defaults.baseURL = axiosApiBase()
// 配置数组参数序列化：将 regional_managers[]=a&regional_managers[]=b 转换为 regional_managers=a&regional_managers=b
axios.defaults.paramsSerializer = {
  indexes: null,
}

createApp(App).use(router).mount('#app')