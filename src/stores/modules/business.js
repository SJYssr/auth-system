import { defineStore } from 'pinia'
import { ref } from 'vue'
import { superAppService, superDashboardService, superDataService, superLogService, publicAppsService, publicAppDetailService, superCardService, superVersionService } from '@/utils/service'

export const useBusinessStore = defineStore('business', () => {
  const apps = ref({})
  const adminLogs = ref({})
  const websiteInfo = ref({})
  const cards = ref({})
  const versions = ref({})
  const dashboardData = ref({
    overview: {
      visit_count: 9120,
      online_visitors: 182,
      click_count: 9520,
      new_users: 156,
      visit_trend: 20,
      visitor_trend: 10,
      click_trend: 12,
      user_trend: 30,
      apps: { total: 0, active: 0 }
    },
    app_distribution: []
  })

  const handleAsync = async (operation) => {
    try {
      return await operation()
    } catch (error) {
      throw error
    }
  }

  // 应用相关
  const fetchSuperApps = (params) => handleAsync(async () => {
    const response = await superAppService.getAll(params)
    apps.value = response || {}
    return response
  })

  const saveApp = (data) => handleAsync(async () => {
    const response = data.id
      ? await superAppService.update(data.id, data)
      : await superAppService.create(data)
    return response
  })

  const deleteApp = (id) => handleAsync(async () => {
    const response = await superAppService.delete(id)
    return response
  })

  // 仪表盘
  const fetchDashboardData = () => handleAsync(async () => {
    const response = await superDashboardService.getData()
    dashboardData.value = response.data
    return response
  })

  // 网站设置
  const getWebsiteInfo = () => handleAsync(async () => {
    const response = await superDataService.getInfo()
    websiteInfo.value = response.data
    return response
  })

  const saveWebsiteInfo = (data) => handleAsync(async () => {
    const response = await superDataService.update(data)
    return response
  })

  // 日志
  const fetchAdminLogs = (params) => handleAsync(async () => {
    const response = await superLogService.getAll(params)
    adminLogs.value = response?.data || {}
    return response?.data || {}
  })

  const deleteAdminLogs = (data) => handleAsync(async () => {
    const response = await superLogService.delete(data)
    return response
  })

  // 公共应用
  const fetchPublicApps = (params) => handleAsync(async () => {
    const response = await publicAppsService.getAll(params)
    return response
  })

  const getPublicAppDetail = (id) => handleAsync(async () => {
    const response = await publicAppDetailService.getDetail(id)
    return response
  })

  // 卡密相关
  const fetchCards = (params) => handleAsync(async () => {
    const response = await superCardService.getAll(params)
    cards.value = response || {}
    return response
  })

  const saveCard = (data) => handleAsync(async () => {
    const response = data.id
      ? await superCardService.update(data.id, data)
      : await superCardService.create(data)
    return response
  })

  const deleteCard = (id) => handleAsync(async () => {
    const response = await superCardService.delete(id)
    return response
  })

  // 版本相关
  const fetchVersions = (params) => handleAsync(async () => {
    const response = await superVersionService.getAll(params)
    versions.value = response || {}
    return response
  })

  const saveVersion = (data) => handleAsync(async () => {
    const response = data.id
      ? await superVersionService.update(data.id, data)
      : await superVersionService.create(data)
    return response
  })

  const deleteVersion = (id) => handleAsync(async () => {
    const response = await superVersionService.delete(id)
    return response
  })

  return {
    apps,
    adminLogs,
    dashboardData,
    websiteInfo,
    cards,
    versions,
    fetchSuperApps,
    saveApp,
    deleteApp,
    fetchDashboardData,
    getWebsiteInfo,
    saveWebsiteInfo,
    fetchAdminLogs,
    deleteAdminLogs,
    fetchPublicApps,
    getPublicAppDetail,
    fetchCards,
    saveCard,
    deleteCard,
    fetchVersions,
    saveVersion,
    deleteVersion
  }
})
