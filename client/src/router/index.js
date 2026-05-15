import { createRouter, createWebHistory } from 'vue-router'
import { useGameStore } from '../stores/game'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue')
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('../views/Game.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    name: 'Admin',
    component: () => import('../views/Admin.vue'),
    meta: { requiresAuth: true, requiresGM: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const gameStore = useGameStore()
  
  if (to.meta.requiresAuth && !gameStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.requiresGM && !gameStore.isGM) {
    next('/game')
  } else {
    next()
  }
})

export default router