import { describe, it, expect, vi, beforeEach } from 'vitest'

// composable 依赖 element-plus 的 ElMessage 做错误提示，测试中替换以隔离 UI 库
vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

import { ElMessage } from 'element-plus'
import { useListPage } from '../useListPage'

// 后端分页契约
const paginated = (rows, total) => ({ success: true, data: rows, pagination: { total_records: total, total_pages: Math.ceil(total / 20) } })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useListPage', () => {
  it('fetchData 拉取数据并解析分页契约', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([{ id: 1 }], 42))
    const { rows, loading, pagination, fetchData } = useListPage({ fetcher })

    expect(loading.value).toBe(true)
    await fetchData()
    expect(fetcher).toHaveBeenCalledWith({ page: 1, per_page: 20 })
    expect(rows.value).toEqual([{ id: 1 }])
    expect(pagination.value.total_records).toBe(42)
    expect(loading.value).toBe(false)
  })

  it('fetcher 收到 filters 合并后的参数', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([], 0))
    const { fetchData } = useListPage({ fetcher, filters: { keyword: '卡密', status: 'enabled' } })
    await fetchData()
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ keyword: '卡密', status: 'enabled' }))
  })

  it('handleSearch 重置页码为 1', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([], 0))
    const { pagination, handleSearch, handleCurrentChange } = useListPage({ fetcher })
    await handleCurrentChange(3)
    expect(pagination.value.page).toBe(3)
    handleSearch()
    await vi.waitFor(() => expect(pagination.value.page).toBe(1))
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('handleSizeChange 更新每页数量并回到第 1 页', async () => {
    const fetcher = vi.fn().mockResolvedValue(paginated([], 0))
    const { pagination, handleSizeChange } = useListPage({ fetcher })
    await handleSizeChange(50)
    expect(pagination.value.per_page).toBe(50)
    expect(pagination.value.page).toBe(1)
  })

  it('fetcher 抛错时提示且 loading 复位、不中断后续使用', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('网络故障')).mockResolvedValue(paginated([{ id: 2 }], 1))
    const { rows, loading, fetchData } = useListPage({ fetcher })
    await fetchData()
    expect(ElMessage.error).toHaveBeenCalledWith('网络故障')
    expect(loading.value).toBe(false)
    await fetchData()
    expect(rows.value).toEqual([{ id: 2 }])
  })
})
