import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/'

const sharedRequest = axios.create({
    baseURL: BASE_URL,
    timeout: 30000
})

sharedRequest.interceptors.request.use(
    config => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`
        }
        return config
    },
    error => Promise.reject(error)
)

sharedRequest.interceptors.response.use(
    response => {
        const res = response.data
        if (res.success === false) {
            return Promise.reject(new Error(res.message || 'Error'))
        }
        return res
    },
    error => {
        if (error.response && error.response.status === 401) {
            // token 失效：清除本地登录态并回登录页。登录页在 hash 根路径 '#/'，
            // 原跳转 /login 在非 hash 路径上不存在（404）。
            localStorage.removeItem('token')
            if (window.location.hash !== '#/') {
                window.location.hash = '#/'
                window.location.reload()
            }
        }
        // 403 是权限不足而非登录态失效：保留 token，仅透出错误信息，
        // 否则普通管理员一次越权点击就会被整站登出
        // 非 2xx 时后端仍返回 { success:false, message } JSON，
        // 归一化为带友好文案的 Error，避免各页面显示 "Request failed with status code xxx"
        const data = error.response && error.response.data
        if (data && typeof data === 'object' && data.message) {
            const norm = new Error(data.message)
            norm.errcode = data.errcode
            norm.status = error.response.status
            return Promise.reject(norm)
        }
        return Promise.reject(error)
    }
)

export const createRequest = () => sharedRequest
export default sharedRequest
