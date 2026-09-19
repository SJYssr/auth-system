<template>
  <section class="products-main">
    <!-- 产品页面主要区域 -->
    <div class="products-container">
      <!-- 标题区域 -->
      <div class="header-section">
        <div class="header-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="#6366f1">
            <path d="M32 8L16 24v24h32V24L32 8z" />
            <path d="M24 40h16v16h-16z" fill="#fff" />
          </svg>
        </div>
        <h1 class="main-title">产品中心</h1>
        <p class="main-subtitle">探索我们的优质应用产品，助力您的业务发展</p>
      </div>

      <!-- 产品筛选和列表区域 -->
      <div class="products-content-section">
        <!-- 左侧分类筛选 -->
        <div class="sidebar-filter">
          <!-- 搜索框 -->
          <div class="search-section">
            <el-input v-model="searchForm.keyword" placeholder="搜索" @input="handleSearch" clearable size="default">
              <template #prefix>
                <el-icon>
                  <Search />
                </el-icon>
              </template>
            </el-input>
          </div>

          <!-- 价格筛选 -->
          <div class="price-filter">
            <div class="filter-title">价格</div>
            <div class="price-options">
              <div class="price-option" :class="{ active: searchForm.price_type === '' }" @click="selectPriceType('')">
                全部
              </div>
              <div class="price-option" :class="{ active: searchForm.price_type === 'free' }"
                @click="selectPriceType('free')">
                免费
              </div>
              <div class="price-option" :class="{ active: searchForm.price_type === 'paid' }"
                @click="selectPriceType('paid')">
                付费
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧产品内容 -->
        <div class="products-content">

          <!-- 产品列表 -->
          <div class="products-grid" v-loading="productsLoading">
            <div v-for="product in products" :key="product.id" class="product-card" @click="viewProductDetail(product)">
              <!-- 产品主要内容区域 -->
              <div class="product-main">
                <!-- 产品图标 -->
                <div class="product-icon">
                  <img v-if="product.icon_url" :src="product.icon_url" :alt="product.app_name"
                    @error="handleIconError" />
                  <div v-else class="default-icon">
                    {{ product.app_name ? product.app_name.charAt(0).toUpperCase() : '?' }}
                  </div>
                </div>

                <!-- 产品信息 -->
                <div class="product-info">
                  <h3 class="product-name">{{ product.app_name }}</h3>
                  <p class="product-description">{{ product.description || '暂无描述' }}</p>
                </div>
              </div>

              <!-- 产品标签和开发者信息 -->
              <div class="product-meta-row">
                <div class="product-tags">

                  <span class="product-version">v{{ product.version || '1.0.0' }}</span>
                </div>
                <span class="developer">{{ product.developer || '官方' }}</span>
              </div>

              <!-- 价格和操作 -->
              <div class="product-footer">
                <div class="price-section">
                  <span v-if="isProductFree(product)" class="price-free">免费</span>
                  <span v-else class="price-amount">付费</span>
                </div>

                <el-button type="primary" size="large" @click.stop="handleProductAction(product)"
                  :disabled="product.status !== 'enabled'" class="action-button">
                  {{ getActionText(product) }}
                </el-button>
              </div>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!productsLoading && products.length === 0" class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>暂无产品</h3>
            <p>当前没有符合条件的产品</p>
          </div>

          <!-- 分页 -->
          <div v-if="products.length > 0" class="pagination-section">
            <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.per_page"
              :total="pagination.total" :page-sizes="[12, 24, 48]" layout="total, sizes, prev, pager, next, jumper"
              @size-change="handleSizeChange" @current-change="handleCurrentChange" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/modules/app'
import { useBusinessStore } from '@/stores/modules/business'
import { publicAppsService } from '@/utils/service'

const router = useRouter()
const appStore = useAppStore()
const businessStore = useBusinessStore()

// 产品数据
const products = ref([])
const productsLoading = ref(false)
const searchForm = reactive({
  keyword: '',
  price_type: ''
})

// 分页
const pagination = reactive({
  page: 1,
  per_page: 12,
  total: 0
})


// 全量产品缓存（用于客户端过滤和分页）
// TODO: 当应用数量超过 100 时，需要改后端 /public/apps 支持服务端分页+搜索参数（keyword, price_type, page, per_page）
const allProducts = ref([])

// 获取产品列表（后端无过滤/分页支持，客户端处理）
const fetchProducts = async () => {
  try {
    productsLoading.value = true
    const response = await businessStore.fetchPublicApps({})

    // 检查API响应结构 — /public/apps 返回 {success: true, data: [array]}
    if (response.success && response.data) {
      allProducts.value = Array.isArray(response.data) ? response.data : (response.data.data || [])
    } else {
      allProducts.value = []
    }

    // 客户端过滤和分页
    applyFiltersAndPaginate()
  } catch (error) {
    console.error('获取产品列表失败:', error)
    ElMessage.error('获取产品列表失败')
  } finally {
    productsLoading.value = false
  }
}

// 客户端过滤和分页
const applyFiltersAndPaginate = () => {
  let filtered = [...allProducts.value]

  // 只显示启用的产品
  filtered = filtered.filter(p => p.status === 'enabled')

  // 关键词搜索
  if (searchForm.keyword) {
    const kw = searchForm.keyword.toLowerCase()
    filtered = filtered.filter(p =>
      (p.app_name && p.app_name.toLowerCase().includes(kw)) ||
      (p.description && p.description.toLowerCase().includes(kw))
    )
  }

  // 价格类型过滤 (apps表用is_free字段)
  if (searchForm.price_type === 'free') {
    filtered = filtered.filter(p => p.is_free == 1)
  } else if (searchForm.price_type === 'paid') {
    filtered = filtered.filter(p => p.is_free != 1)
  }

  // 分页
  pagination.total = filtered.length
  const start = (pagination.page - 1) * pagination.per_page
  products.value = filtered.slice(start, start + pagination.per_page)
}

// 搜索处理（数据已在客户端缓存，过滤/翻页无需重新请求）
const handleSearch = () => {
  pagination.page = 1
  applyFiltersAndPaginate()
}

// 价格类型选择
const selectPriceType = (priceType) => {
  searchForm.price_type = priceType
  handleSearch()
}

// 分页处理
const handleSizeChange = (size) => {
  pagination.per_page = size
  pagination.page = 1
  applyFiltersAndPaginate()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  applyFiltersAndPaginate()
}

// 产品详情：跳转到应用详情页面
const viewProductDetail = (product) => {
  router.push(`/app/${product.id}`)
}

// 产品操作
const handleProductAction = (product) => {
  if (product.status !== 'enabled') {
    ElMessage.warning('该产品暂时不可用')
    return
  }

  // 检查登录状态
  const isLoggedIn = appStore.initializeInfo?.login_status?.is_logged_in

  if (!isLoggedIn) {
    // 未登录，跳转到登录页面（登录页是 hash 根路径 '/'，此前跳 /login 为死链）
    ElMessage.info('请先登录后再进行购买')
    router.push('/')
    return
  }

  // 进入应用详情页购买/下载（此前跳转的 /admin/appcenter 路由不存在，是死链）
  router.push(`/app/${product.id}`)
}

// 判断产品是否免费 (apps表没有price字段，用is_free判断)
const isProductFree = (product) => {
  if (!product) return false
  return product.is_free == 1 || product.is_free === true
}

// 获取操作按钮文本
const getActionText = (product) => {
  if (!product) return '查看'
  if (product.status !== 'enabled') return '维护中'
  if (isProductFree(product)) return '免费使用'
  return '立即购买'
}




// 图标错误处理
const handleIconError = (event) => {
  event.target.style.display = 'none'
  if (event.target.nextElementSibling) {
    event.target.nextElementSibling.style.display = 'flex'
  }
}

onMounted(() => {
  fetchProducts()
})
</script>

<style scoped>
/* 主要内容区域 */
.products-main {
  background: linear-gradient(135deg, #fefefe 0%, #f8fafc 100%);
  min-height: 100vh;
  padding: 40px 0;
  position: relative;
  overflow: hidden;
}

/* 网格背景 */
.products-main::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(#f1f5f9 1px, transparent 1px),
    linear-gradient(90deg, #f1f5f9 1px, transparent 1px);
  background-size: 24px 24px;
  z-index: 1;
}



.products-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 32px;
  position: relative;
  z-index: 2;
}

/* 标题区域 */
.header-section {
  text-align: center;
  margin-bottom: 60px;
}

.header-icon {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.main-title {
  font-size: 36px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 16px;
  line-height: 1.2;
}

.main-subtitle {
  font-size: 18px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}

/* 产品内容区域 */
.products-content-section {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}



/* 左侧边栏筛选 */
.sidebar-filter {
  width: 260px;
  flex-shrink: 0;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e5e7eb;
  overflow: hidden;
  height: fit-content;
  position: sticky;
  top: 24px;
  z-index: 10;
}

.search-section {
  padding: 24px 20px;
  border-bottom: 1px solid rgb(219, 223, 233);
}

.search-section :deep(.el-input) {
  border-radius: 10px;
}

.search-section :deep(.el-input__wrapper) {
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: none;
  transition: all 0.2s ease;
  padding: 0 12px;
  height: 40px;
}

.search-section :deep(.el-input__wrapper:hover) {
  border-color: #d1d5db;
}

.search-section :deep(.el-input__wrapper.is-focus) {
  border-color: #3b82f6;
}

.price-filter {
  padding: 24px 20px;
}

.filter-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 16px;
  letter-spacing: -0.025em;
}

.price-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 0 0 8px;
}

.price-option {
  padding: 10px 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  border-radius: 8px;
  font-weight: 400;
}

.price-option:hover {
  background: #f8fafc;
  color: #374151;
  transform: translateX(2px);
}

.price-option.active {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
  font-weight: 500;
  border: 1px solid #bfdbfe;
}

/* 右侧产品内容区 */
.products-content {
  flex: 1;
  min-width: 0;
}

/* 产品网格 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 40px;
}

.product-card {
  background: white;
  border-radius: 15px;
  padding: 24px;
  border: 1px solid rgb(219, 223, 233);
  transition: all 0.3s ease;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.product-card:hover {
  transform: translateY(-8px);
  border-color: #d1d5db;
}

/* 产品主要内容区域 */
.product-main {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 12px;
}

.product-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.product-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.default-icon {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 24px;
  font-weight: 600;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 6px;
  color: #111827;
  line-height: 1.3;
}

.product-description {
  color: #6b7280;
  margin: 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.product-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-version {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 6px;
}

.developer {
  font-size: 12px;
  color: #6b7280;
  white-space: nowrap;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #f3f4f6;
}

.price-section {
  display: flex;
  align-items: center;
}

.price-free {
  color: #10b981;
  font-weight: 600;
}

.price-amount {
  color: #f59e0b;
  font-weight: 600;
  font-size: 16px;
}

.action-button {
  padding: 12px 24px !important;
  font-size: 14px !important;
  font-weight: 600 !important;
  border-radius: 12px !important;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6b7280;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #374151;
}

.empty-state p {
  margin: 0;
}

/* 分页 */
.pagination-section {
  display: flex;
  justify-content: center;
  padding-top: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .products-container {
    padding: 16px;
    flex-direction: column;
    gap: 20px;
  }

  .sidebar-filter {
    width: 100%;
    order: 1;
    position: static;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }

  .products-content {
    order: 2;
  }

  .search-section {
    padding: 20px 16px;
  }

  .search-section :deep(.el-input__wrapper) {
    height: 44px;
    padding: 0 14px;
  }

  .price-filter {
    padding: 20px 16px;
  }

  .filter-title {
    font-size: 14px;
    margin-bottom: 14px;
    font-weight: 600;
  }

  .price-options {
    padding: 0 0 0 6px;
    gap: 2px;
  }

  .price-option {
    padding: 10px 12px;
    font-size: 13px;
    border-radius: 6px;
  }

  .price-option:hover {
    transform: none;
  }

  .products-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .product-card {
    padding: 16px;
    border-radius: 16px;
  }

  .product-main {
    gap: 12px;
    margin-bottom: 8px;
  }

  .product-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
  }

  .default-icon {
    font-size: 18px;
  }

  .product-name {
    font-size: 16px;
    margin: 0 0 4px 0;
  }

  .product-description {
    font-size: 13px;
    margin: 0;
    -webkit-line-clamp: 1;
  }

  .product-meta-row {
    gap: 8px;
    margin-bottom: 12px;
    padding: 0 2px;
  }

  .developer {
    font-size: 11px;
  }

  .product-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .action-button {
    padding: 10px 20px !important;
    font-size: 13px !important;
    border-radius: 10px !important;
  }
}
</style>