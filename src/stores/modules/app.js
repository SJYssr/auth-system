import { defineStore } from 'pinia'
import { ref } from 'vue'
import { publicInitService, publicLoginService } from '@/utils/service'

export const useAppStore = defineStore('app', () => {

  const isCollapse = ref(false)
  const initializeInfo = ref({})

  const handleAsync = async (operation) => {
    try { return await operation() } catch (error) { throw error }
  }

  const initialize = () => handleAsync(async () => {
    const response = await publicInitService.initialize()
    initializeInfo.value = response.data
    if (!response.data.login_status?.is_logged_in) {
      localStorage.removeItem('token')
    }
    return response
  })

  const login = (data) => handleAsync(async () => {
    const response = await publicLoginService.login(data)
    return response
  })

  const toggleSidebar = () => { isCollapse.value = !isCollapse.value }

  const logout = () => {
    initializeInfo.value = {}
    localStorage.removeItem('token')
  }

  const setInitializeInfo = (data) => { initializeInfo.value = data }

  return { isCollapse, initializeInfo, initialize, toggleSidebar, logout, login, setInitializeInfo }
})
