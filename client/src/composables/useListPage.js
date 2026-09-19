import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 列表页统一数据流：loading / 分页 / 搜索重置 / 错误兜底。
 *
 * 约定 fetcher(params) 返回后端分页契约：{ success, data: [...], pagination: {...} }。
 * filters 会被转成响应式对象，随每次请求并入 params（{ page, per_page, ...filters }）。
 *
 * 用法：
 *   const { rows: list, loading, filters: searchForm, pagination,
 *           fetchData, handleSearch, handleCurrentChange, handleSizeChange } = useListPage({
 *     fetcher: (params) => superApiService.getAll(params),
 *     filters: { keyword: '' }
 *   })
 */
export function useListPage({ fetcher, filters = {}, perPage = 20 }) {
  const rows = ref([])
  const loading = ref(true)
  const filterState = reactive({ ...filters })
  const pagination = ref({ page: 1, per_page: perPage, total_records: 0 })

  const fetchData = async () => {
    try {
      loading.value = true
      // 只下发分页与筛选参数，total_records 等回显字段不回传
      const response = await fetcher({
        page: pagination.value.page,
        per_page: pagination.value.per_page,
        ...filterState
      })
      rows.value = response?.data || []
      pagination.value.total_records = Number(response?.pagination?.total_records) || 0
    } catch (error) {
      console.error('列表加载失败:', error)
      ElMessage.error(error.message || '加载失败')
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.value.page = 1
    fetchData()
  }

  const handleCurrentChange = (page) => {
    pagination.value.page = page
    fetchData()
  }

  const handleSizeChange = (size) => {
    pagination.value.per_page = size
    pagination.value.page = 1
    fetchData()
  }

  return { rows, loading, filters: filterState, pagination, fetchData, handleSearch, handleCurrentChange, handleSizeChange }
}
