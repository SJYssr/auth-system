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
    error => Promise.reject(error)
)

export const createRequest = () => sharedRequest
export default sharedRequest
