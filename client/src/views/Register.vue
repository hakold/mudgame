<template>
  <div class="auth-container">
    <div class="auth-box">
      <h1>侠客行</h1>
      <h2>注册</h2>
      
      <div v-if="error" class="error-message">{{ error }}</div>
      
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label>用户名</label>
          <input v-model="username" type="text" required placeholder="3-20个字符，字母数字下划线" />
        </div>
        
        <div class="form-group">
          <label>密码</label>
          <input v-model="password" type="password" required placeholder="至少6个字符" />
        </div>
        
        <div class="form-group">
          <label>邮箱</label>
          <input v-model="email" type="email" required placeholder="用于找回密码" />
        </div>
        
        <div class="form-group">
          <label>角色名</label>
          <input v-model="characterName" type="text" required placeholder="2-12个字符，游戏中的名字" />
        </div>
        
        <div class="form-group">
          <label>性别</label>
          <select v-model="gender" required>
            <option value="">请选择</option>
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
        </div>
        
        <button type="submit" class="btn">注册</button>
      </form>
      
      <div class="auth-links">
        <router-link to="/login">已有账号？立即登录</router-link>
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
const email = ref('')
const characterName = ref('')
const gender = ref('')
const error = ref('')

async function handleRegister() {
  error.value = ''
  
  if (!username.value || !password.value || !email.value || !characterName.value || !gender.value) {
    error.value = '请填写所有必填信息'
    return
  }
  
  const result = await gameStore.register({
    username: username.value,
    password: password.value,
    email: email.value,
    characterName: characterName.value,
    gender: gender.value
  })
  
  if (result.success) {
    router.push('/game')
  } else {
    error.value = result.message
  }
}
</script>