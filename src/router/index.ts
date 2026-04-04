import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'purchase-quantity',
      component: () => import('@/pages/PurchaseQuantity.vue'),
    },
  ],
})

export default router
