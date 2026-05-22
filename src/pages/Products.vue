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

          <!-- 分类导航 -->
          <div class="category-nav">
            <div class="nav-title">全部分类</div>
            <div class="nav-list">
              <div class="nav-item" :class="{ active: searchForm.category === '' }" @click="selectCategory('')">
                全部分类
              </div>
              <div v-for="category in categories" :key="category.id" class="nav-item"
                :class="{ active: searchForm.category === category.id }" @click="selectCategory(category.id)">
                {{ category.label }}
              </div>
            </div>
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
                  <span v-if="product.price == 0 || product.is_free" class="price-free">免费</span>
                  <span v-else class="price-amount">¥{{ product.price }}</span>
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

  <!-- 产品详情弹窗 -->
  <el-dialog v-model="detailVisible" :title="selectedProduct ? selectedProduct.app_name : ''" width="600px"
    @close="handleCloseDetail">
    <div v-if="selectedProduct" class="product-detail">
      <div class="detail-header">
        <div class="detail-icon">
          <img v-if="selectedProduct.icon_url" :src="selectedProduct.icon_url" :alt="selectedProduct.app_name"
            @error="handleIconError" />
          <div v-else class="default-icon">
            {{ selectedProduct.app_name ? selectedProduct.app_name.charAt(0).toUpperCase() : '?' }}
          </div>
        </div>
        <div class="detail-info">
          <h3>{{ selectedProduct.app_name }}</h3>
          <p class="detail-developer">开发者：{{ selectedProduct.developer || '官方' }}</p>
          <div class="detail-tags">

            <span class="version-tag">v{{ selectedProduct.version || '1.0.0' }}</span>
          </div>
        </div>
      </div>

      <div class="detail-content">
        <h4>产品描述</h4>
        <p>{{ selectedProduct.description || '暂无详细描述' }}</p>

        <div class="detail-grid">
          <div class="detail-item">
            <label>价格：</label>
            <span v-if="selectedProduct.price == 0 || selectedProduct.is_free" class="price-free">免费</span>
            <span v-else class="price-amount">¥{{ selectedProduct.price }}</span>
          </div>
          <div class="detail-item">
            <label>状态：</label>
            <el-tag :type="selectedProduct.status === 'enabled' ? 'success' : 'info'">
              {{ selectedProduct.status === 'enabled' ? '可用' : '维护中' }}
            </el-tag>
          </div>
          <div class="detail-item">
            <label>创建时间：</label>
            <span>{{ formatDate(selectedProduct.created_at) }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleProductAction(selectedProduct)"
          :disabled="!selectedProduct || selectedProduct.status !== 'enabled'">
          {{ getActionText(selectedProduct) }}
        </el-button>
      </div>
    </template>
  </el-dialog>
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
  category: '',
  price_type: ''
})

// 分类数据
const categories = ref([])
const categoriesLoading = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  per_page: 12,
  total: 0
})

// 产品详情弹窗
const detailVisible = ref(false)
const selectedProduct = ref(null)


// 获取产品列表
const fetchProducts = async () => {
  try {
    productsLoading.value = true
    const params = {
      page: pagination.page,
      per_page: pagination.per_page,
      ...searchForm
    }

    const response = await businessStore.fetchPublicApps(params)

    // 检查API响应结构
    if (response.success && response.data) {
      products.value = response.data.data || []
      pagination.total = (response.data.pagination && response.data.pagination.total) || 0
    } else {
      products.value = []
      pagination.total = 0
    }
  } catch (error) {
    console.error('获取产品列表失败:', error)
    ElMessage.error('获取产品列表失败')
  } finally {
    productsLoading.value = false
  }
}

// 搜索处理
const handleSearch = () => {
  pagination.page = 1
  fetchProducts()
}

// 分类选择
// 价格类型选择
const selectPriceType = (priceType) => {
  searchForm.price_type = priceType
  handleSearch()
}

// 分页处理
const handleSizeChange = (size) => {
  pagination.per_page = size
  pagination.page = 1
  fetchProducts()
}

const handleCurrentChange = (page) => {
  pagination.page = page
  fetchProducts()
}

// 产品详情
const viewProductDetail = (product) => {
  // 跳转到应用详情页面
  router.push(`/app/${product.id}`)
}

const handleCloseDetail = () => {
  detailVisible.value = false
  selectedProduct.value = null
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
    // 未登录，跳转到登录页面
    ElMessage.info('请先登录后再进行购买')
    router.push('/login')
    return
  }

  // 已登录，根据产品类型处理
  if (product.price == 0 || product.is_free) {
    // 免费产品，直接跳转到应用中心
    ElMessage.success('正在为您跳转到应用中心...')
    router.push('/admin/appcenter')
  } else {
    // 付费产品，跳转到应用中心进行购买
    ElMessage.success('正在为您跳转到应用中心进行购买...')
    router.push('/admin/appcenter')
  }
}

// 获取操作按钮文本
const getActionText = (product) => {
  if (!product) return '查看'
  if (product.status !== 'enabled') return '维护中'
  if (product.price == 0 || product.is_free) return '免费使用'
  return '立即购买'
}




// 图标错误处理
const handleIconError = (event) => {
  event.target.style.display = 'none'
  if (event.target.nextElementSibling) {
    event.target.nextElementSibling.style.display = 'flex'
  }
}

// 日期格式化
const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('zh-CN')
}

onMounted(() => {
  fetchCategories()
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

.category-nav {
  padding: 24px 0 20px;
  border-bottom: 1px solid rgb(219, 223, 233);
}

.nav-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
  padding: 0 20px 16px;
  letter-spacing: -0.025em;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 12px;
}

.nav-item {
  padding: 12px 16px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  border-radius: 8px;
  position: relative;
  font-weight: 400;
}

.nav-item:hover {
  background: #f8fafc;
  color: #374151;
  transform: translateX(2px);
}

.nav-item.active {
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  color: #1d4ed8;
  font-weight: 500;
  border: 1px solid #bfdbfe;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #3b82f6;
  border-radius: 0 2px 2px 0;
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

/* 产品详情弹窗 */
.product-detail {
  background: white;
  border-radius: 16px;
  padding: 32px;
  max-width: 600px;
  width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
}

.detail-header {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.detail-icon {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f8fafc;
  border: 1px solid rgb(219, 223, 233);
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-icon .default-icon {
  background: white;
  color: #6b7280;
  font-size: 32px;
  font-weight: 600;
}

.detail-info h3 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #111827;
}

.detail-developer {
  margin: 0 0 12px;
  color: #6b7280;
}

.detail-tags {
  display: flex;
  align-items: center;
  gap: 8px;
}

.version-tag {
  font-size: 12px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 6px;
}

.detail-content h4 {
  margin: 0 0 12px;
  color: #374151;
}

.detail-content p {
  margin: 0 0 20px;
  color: #6b7280;
  line-height: 1.6;
}

.detail-grid {
  display: grid;
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-item label {
  font-weight: 500;
  color: #374151;
  min-width: 80px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .products-container {
    padding: 16px;
    flex-direction: column;
    gap: 20px;
  }

  .products-hero {
    padding: 40px 0;
  }

  .hero-title {
    font-size: 28px;
  }

  .hero-subtitle {
    font-size: 16px;
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

  .category-nav {
    padding: 20px 0 16px;
  }

  .nav-title {
    padding: 0 16px 14px;
    font-size: 14px;
    font-weight: 600;
  }

  .nav-list {
    padding: 0 8px;
    gap: 1px;
  }

  .nav-item {
    padding: 12px 14px;
    font-size: 13px;
    border-radius: 6px;
  }

  .nav-item:hover {
    transform: none;
  }

  .nav-item.active::before {
    width: 2px;
    height: 14px;
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

  .detail-header {
    flex-direction: column;
    text-align: center;
  }

  .detail-icon {
    align-self: center;
  }
}
</style>