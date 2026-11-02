import { createRouter, createWebHistory } from 'vue-router';

import StorefrontPage from './StorefrontPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/tiendas' },
    { path: '/tiendas', name: 'stores', component: StorefrontPage },
    { path: '/tiendas/:storeId', name: 'store', component: StorefrontPage },
    { path: '/checkout', name: 'checkout', component: StorefrontPage },
    { path: '/:pathMatch(.*)*', redirect: '/tiendas' },
  ],
});

export default router;
