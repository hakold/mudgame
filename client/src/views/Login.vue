<template>
  <div class="auth-container">
    <div class="auth-box">
      <h1>侠客行</h1>
      <h2>登录</h2>
      
      <div v-if="error" class="error-message">{{ error }}</div>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" type="text" required placeholder="请输入用户名" />
        </div>
        
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" required placeholder="请输入密码" />
        </div>
        
        <button type="submit" class="btn">登录</button>
      </form>
      
      <div class="auth-links">
        <router-link to="/register">没有账号？立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'

const router = useRouter()
const gameStore = useGameStore()

const username = ref('')
const password = ref('')
const error = ref('')

async function handleLogin() {
  error.value = ''
  
  const result = await gameStore.login(username.value, password.value)
  
  if (result.success) {
    router.push('/game')
  } else {
    error.value = result.message
  }
}
</script>