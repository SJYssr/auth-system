import { defineStore } from 'pinia'
import { ref } from 'vue'
import { superAppService, superDashboardService, superDataService, superLogService, publicAppsService, superCardService, superVersionService, userDashboardService } from '@/utils/service'

export const useBusinessStore = defineStore('business', () => {
  const apps = ref({})
  const adminLogs = ref({})
  const websiteInfo = ref({})
  const cards = ref({})
  const versions = ref({})
  const dashboardData = ref({
    overview: { apps: { total: 0, active: 0 }, cards: { total: 0, activated: 0, expired: 0 }, online: { count: 0 } },
    app_distribution: []
  })

  const handleAsync = async (operation) => { try { return await operation() } catch (error) { throw error } }

  const fetchSuperApps = (params) => handleAsync(async () => { const r = await superAppService.getAll(params); apps.value = r || {}; return r })
  const saveApp = (data) => handleAsync(async () => data.id ? superAppService.update(data.id, data) : superAppService.create(data))
  const deleteApp = (id) => handleAsync(async () => superAppService.delete(id))
  const fetchDashboardData = () => handleAsync(async () => {
    const isUser = window.location.pathname.startsWith('/useradmin')
    const r = isUser ? await userDashboardService.getData() : await superDashboardService.getData()
    dashboardData.value = r.data
    return r
  })
  const getWebsiteInfo = () => handleAsync(async () => { const r = await superDataService.getInfo(); websiteInfo.value = r.data; return r })
  const saveWebsiteInfo = (data) => handleAsync(async () => superDataService.update(data))
  const fetchAdminLogs = (params) => handleAsync(async () => { const r = await superLogService.getAll(params); adminLogs.value = r?.data || {}; return r?.data || {} })
  const deleteAdminLogs = (data) => handleAsync(async () => superLogService.delete(data))
  const fetchPublicApps = (params) => handleAsync(async () => publicAppsService.getAll(params))
  const getPublicAppDetail = (id) => handleAsync(async () => publicAppsService.getDetail(id))
  const fetchCards = (params) => handleAsync(async () => { const r = await superCardService.getAll(params); cards.value = r || {}; return r })
  const saveCard = (data) => handleAsync(async () => data.id ? superCardService.update(data.id, data) : superCardService.create(data))
  const deleteCard = (id) => handleAsync(async () => superCardService.delete(id))
  const fetchVersions = (params) => handleAsync(async () => { const r = await superVersionService.getAll(params); versions.value = r || {}; return r })
  const saveVersion = (data) => handleAsync(async () => data.id ? superVersionService.update(data.id, data) : superVersionService.create(data))
  const deleteVersion = (id) => handleAsync(async () => superVersionService.delete(id))

  return { apps, adminLogs, dashboardData, websiteInfo, cards, versions, fetchSuperApps, saveApp, deleteApp, fetchDashboardData, getWebsiteInfo, saveWebsiteInfo, fetchAdminLogs, deleteAdminLogs, fetchPublicApps, getPublicAppDetail, fetchCards, saveCard, deleteCard, fetchVersions, saveVersion, deleteVersion }
})
