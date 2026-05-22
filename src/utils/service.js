import { createRequest } from '@/utils/request'

const request = createRequest()

const publicLoginService = {
    login: (data) => request.post('/public/login', data)
}

const publicInitService = {
    initialize: () => request.get('/public/init')
}

const publicAppsService = {
    getAll: (params = {}) => request.get('/public/apps', { params }),
    getDetail: (id) => request.get(`/public/apps/${id}`)
}

const superDashboardService = {
    getData: () => request.get('/admin/dashboard')
}

const superAppService = {
    getAll: (params = {}) => request.get('/admin/apps', { params }),
    create: (data) => request.post('/admin/apps', data),
    update: (id, data) => request.put(`/admin/apps/${id}`, data),
    delete: (id) => request.delete(`/admin/apps/${id}`)
}

const superDataService = {
    getInfo: () => request.get('/admin/site-data'),
    update: (data) => request.put('/admin/site-data', data)
}

const superLogService = {
    getAll: (params = {}) => request.get('/admin/logs', { params }),
    delete: (data) => request.delete('/admin/logs', { data })
}

const superCardService = {
    getAll: (params = {}) => request.get('/admin/cards', { params }),
    create: (data) => request.post('/admin/cards', data),
    update: (id, data) => request.put(`/admin/cards/${id}`, data),
    delete: (id) => request.delete(`/admin/cards/${id}`)
}

const superApiService = {
    getAll: (params = {}) => request.get('/admin/apis', { params }),
    create: (data) => request.post('/admin/apis', data),
    update: (id, data) => request.put(`/admin/apis/${id}`, data),
    delete: (id) => request.delete(`/admin/apis/${id}`)
}

const superErrorCodeService = {
    getAll: (params = {}) => request.get('/admin/error-codes', { params }),
    create: (data) => request.post('/admin/error-codes', data),
    update: (id, data) => request.put(`/admin/error-codes/${id}`, data),
    delete: (id) => request.delete(`/admin/error-codes/${id}`)
}

const superVersionService = {
    getAll: (params = {}) => request.get('/admin/versions', { params }),
    create: (data) => request.post('/admin/versions', data),
    update: (id, data) => request.put(`/admin/versions/${id}`, data),
    delete: (id) => request.delete(`/admin/versions/${id}`)
}

export {
  publicLoginService,
  publicInitService,
  publicAppsService,
  superAppService,
  superDashboardService,
  superDataService,
  superLogService,
  superCardService,
  superVersionService,
  superApiService,
  superErrorCodeService,
}
