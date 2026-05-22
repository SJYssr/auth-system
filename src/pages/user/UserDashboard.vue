<template>
  <el-main>
    <div class="metrics-row">
      <div class="metric-card" v-for="m in metrics" :key="m.label">
        <div class="metric-title">{{ m.label }}</div>
        <div class="metric-value">{{ m.value }}</div>
      </div>
    </div>
  </el-main>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { userAppService, userCardService, userVersionService } from '@/utils/service'

const metrics = ref([
  { label: '应用数量', value: 0 },
  { label: '卡密数量', value: 0 },
  { label: '版本数量', value: 0 }
])

onMounted(async () => {
  try {
    const [apps, cards, versions] = await Promise.all([
      userAppService.getAll({ per_page: 1 }),
      userCardService.getAll({ per_page: 1 }),
      userVersionService.getAll({ per_page: 1 })
    ])
    metrics.value[0].value = apps?.pagination?.total_records || 0
    metrics.value[1].value = cards?.pagination?.total_records || 0
    metrics.value[2].value = versions?.pagination?.total_records || 0
  } catch {}
})
</script>

<style scoped>
.metrics-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 20px; }
.metric-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; }
.metric-title { font-size: 14px; color: #6b7280; margin-bottom: 8px; }
.metric-value { font-size: 32px; font-weight: 700; color: #1f2937; }
</style>
