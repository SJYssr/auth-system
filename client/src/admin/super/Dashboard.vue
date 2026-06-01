<template>
  <el-main>
    <!-- 顶部指标卡片 -->
    <div class="metrics-row">
      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">📱</div>
          <div class="metric-title">软件数量</div>
        </div>
        <div class="metric-value-large">{{ totalApps }}</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">🎫</div>
          <div class="metric-title">卡密数量</div>
        </div>
        <div class="metric-items">
          <div class="metric-item">
            <div class="metric-label">总数</div>
            <div class="metric-value">{{ totalCards }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-item">
            <div class="metric-label">已激活</div>
            <div class="metric-value">{{ activatedCards }}</div>
          </div>
          <div class="metric-divider"></div>
          <div class="metric-item">
            <div class="metric-label">已到期</div>
            <div class="metric-value">{{ expiredCards }}</div>
          </div>
        </div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <div class="metric-icon">🟢</div>
          <div class="metric-title">在线数量</div>
        </div>
        <div class="metric-value-large">{{ onlineCount }}</div>
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="charts-section">
      <!-- 左侧柱状图 -->
      <div class="chart-container">
        <div class="chart-header">
          <div class="chart-title">应用激活分布</div>
        </div>
        <div ref="barChart" class="chart-content"></div>
      </div>

      <!-- 右侧曲线图 -->
      <div class="chart-container">
        <div class="chart-header">
          <div class="chart-title">收入趋势</div>
        </div>
        <div ref="lineChart" class="chart-content"></div>
      </div>
    </div>

    <!-- 最近记录：左右两列 -->
    <div class="recent-sections">
      <!-- 左：最近激活记录 -->
      <div class="recent-block">
        <div class="section-header">
          <h3 class="section-title">最近激活记录</h3>
          <span class="section-count">{{ recentAuths.length }} 条记录</span>
        </div>
        
        <div class="records-container" v-if="recentAuths.length > 0">
          <div
            v-for="(item, index) in recentAuths"
            :key="index"
            class="record-item status-success"
          >
            <div class="record-content">
              <div class="record-main">
                <span class="record-app">{{ item.app_name }}</span>
                <span class="record-user">{{ item.card_type || '未知类型' }}</span>
              </div>
              <div class="record-meta">
                <span class="record-time">{{ formatTime(item.activated_at) }}</span>
                <span class="record-badge badge-success">{{ item.card_type }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" v-else>
          <div class="empty-content">
            <div class="empty-icon">📋</div>
            <div class="empty-text">暂无激活记录</div>
          </div>
        </div>
      </div>

      <!-- 右：最近登录记录 -->
      <div class="recent-block">
        <div class="section-header">
          <h3 class="section-title">最近登录记录</h3>
          <span class="section-count">{{ recentLogins.length }} 条记录</span>
        </div>

        <div class="records-container" v-if="recentLogins.length > 0">
          <div 
            v-for="(log, idx) in recentLogins" 
            :key="idx" 
            class="record-item"
            :class="log.response_status === 'success' ? 'status-success' : 'status-error'"
          >
            <div class="record-content">
              <div class="record-main">
                <span class="record-app">{{ log.username || '未知用户' }}</span>
                <span class="record-user">{{ log.ip_address || '未知IP' }}</span>
              </div>
              <div class="record-meta">
                <span class="record-time">{{ formatTime(log.created_at) }}</span>
                <span class="record-badge" :class="log.response_status === 'success' ? 'badge-success' : 'badge-error'">
                  {{ log.response_status === 'success' ? '成功' : '失败' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" v-else>
          <div class="empty-content">
            <div class="empty-icon">🔐</div>
            <div class="empty-text">暂无登录记录</div>
          </div>
        </div>
      </div>
    </div>
  </el-main>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import * as echarts from 'echarts'
import { useBusinessStore } from '@/stores/modules/business'

// store
const businessStore = useBusinessStore()

// chart refs and instances
const barChart = ref(null)
const lineChart = ref(null)
let barChartInstance = null
let lineChartInstance = null

// metrics computed
const totalApps = computed(() => Number(businessStore.dashboardData?.overview?.apps?.total ?? 0))
const totalCards = computed(() => Number(businessStore.dashboardData?.overview?.cards?.total ?? 0))
const activatedCards = computed(() => Number(businessStore.dashboardData?.overview?.cards?.activated ?? 0))
const expiredCards = computed(() => Number(businessStore.dashboardData?.overview?.cards?.expired ?? 0))
const onlineCount = computed(() => Number(businessStore.dashboardData?.overview?.online?.count ?? 0))

// recent activated cards
const recentAuths = computed(() => {
  const list = businessStore.dashboardData?.recent_cards ?? []
  return Array.isArray(list) ? list : []
})

// recent logs (from admin_logs)
const recentLogins = computed(() => {
  const list = businessStore.dashboardData?.recent_logs ?? []
  return Array.isArray(list) ? list : []
})

// time formatter
function formatTime(input) {
  if (!input) return ''
  try {
    const normalized = String(input).replace(/-/g, '/').replace('T', ' ').replace(/\\.\d+Z?$/, '')
    const date = new Date(normalized)
    if (isNaN(date.getTime())) return String(input)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
  } catch (e) {
    return String(input)
  }
}

// init charts
const initBarChart = () => {
  if (!barChart.value) return
  const data = businessStore.dashboardData?.app_distribution ?? []
  const x = data.map(d => d.app_name)
  if (!barChartInstance) barChartInstance = echarts.init(barChart.value)
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: cardTypes },
    grid: { top: '15%', left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: x, axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', minInterval: 1 },
    series: cardTypes.map((ct, i) => ({
      name: ct, type: 'bar', barWidth: '18%',
      data: data.map(d => Number(d[ct] ?? 0)),
      itemStyle: { color: cardColors[i] }
    }))
  }
  barChartInstance.setOption(option, true)
}

const cardTypes = ['小时卡', '天卡', '月卡', '年卡']
const cardColors = ['#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']

const initLineChart = () => {
  if (!lineChart.value) return
  const data = businessStore.dashboardData?.revenue ?? []
  const x = data.map(d => d.app_name)
  if (!lineChartInstance) lineChartInstance = echarts.init(lineChart.value)
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: cardTypes },
    grid: { top: '15%', left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: x, axisTick: { alignWithLabel: true } },
    yAxis: { type: 'value', name: '收入(元)', minInterval: 1 },
    series: cardTypes.map((ct, i) => ({
      name: ct, type: 'bar', barWidth: '18%',
      data: data.map(d => Number(d[ct] ?? 0)),
      itemStyle: { color: cardColors[i] }
    }))
  }
  lineChartInstance.setOption(option, true)
}

const handleResize = () => {
  if (barChartInstance) barChartInstance.resize()
  if (lineChartInstance) lineChartInstance.resize()
}

onMounted(async () => {
  await businessStore.fetchDashboardData()
  initBarChart()
  initLineChart()
  window.addEventListener('resize', handleResize)
})

watch(() => businessStore.dashboardData, () => {
  initBarChart()
  initLineChart()
}, { deep: false })

onUnmounted(() => {
  if (barChartInstance) { barChartInstance.dispose(); barChartInstance = null }
  if (lineChartInstance) { lineChartInstance.dispose(); lineChartInstance = null }
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
/* 顶部指标卡片样式 */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.metric-card {
  background: #fefefe;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 15px;
  padding: 24px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  transition: all 0.15s ease;
  position: relative;
}

.metric-card:hover {
  border-color: #d1d5db;
  background: #ffffff;
}

.metric-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.metric-icon {
  font-size: 24px;
  opacity: 0.8;
}

.metric-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.metric-items {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
}

.metric-label {
  font-size: 14px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #1f2937;
}

.metric-value-large {
  font-size: 36px;
  font-weight: 700;
  color: #1f2937;
  text-align: center;
  padding: 8px 0;
}

.metric-divider {
  width: 1px;
  height: 40px;
  background: #e5e7eb;
  margin: 0 16px;
}

/* 图表区域样式 */
.charts-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.chart-container {
  background: #fefefe;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 15px;
  padding: 24px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.chart-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.chart-content {
  height: 280px;
}

/* 最近记录区域样式 - 扁平化设计 */
.recent-sections {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.recent-block {
  background: #fefefe;
  border: 1px solid rgb(219, 223, 233);
  border-radius: 15px;
  padding: 16px;
  transition: all 0.15s ease;
}

.recent-block:hover {
  border-color: #d1d5db;
  background: #ffffff;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.section-title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
}

.section-count {
  font-size: 11px;
  color: #6b7280;
  background: #f8f9fa;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #f5f6f7;
}

.records-container {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.record-item {
    background: transparent;
    padding: 13px 0;
    transition: all 0.15s ease;
    position: relative;
    border-bottom: 1px solid #f5f6f7;
}

.record-item:last-child {
  border-bottom: none;
}

.record-item:hover {
  background: #f9fafb;
}

.record-item.status-success::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #000000;
  border-radius: 2px;
}

.record-item.status-disabled::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #b0271a;
  border-radius: 2px;
}

.record-item.status-error::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 16px;
  background: #ef4444;
  border-radius: 2px;
}

.record-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: 12px;
}

.record-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.record-app {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  line-height: 1.3;
}

.record-user {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.3;
}

.record-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.record-time {
  font-size: 10px;
  color: #9ca3af;
}

.record-badge {
  padding: 3px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid transparent;
}

.badge-success {
  background: #f0f9f4;
  color: #166534;
  border-color: #d1f2df;
}

.badge-disabled {
  background: #f8f9fa;
  color: #495057;
  border-color: #e9ecef;
}

.badge-error {
  background: #fef5f5;
  color: #c53030;
  border-color: #fed7d7;
}

.empty-state {
  padding: 20px 16px;
  text-align: center;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px dashed #f0f1f2;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.empty-icon {
  font-size: 24px;
  opacity: 0.4;
  filter: grayscale(0.8);
}

.empty-text {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .metrics-row {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .metrics-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .charts-section {
    grid-template-columns: 1fr;
  }
  .recent-sections {
    grid-template-columns: 1fr;
  }
}
</style>