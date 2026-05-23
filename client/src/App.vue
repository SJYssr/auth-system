<template>
  <router-view v-slot="{ Component }">
    <transition name="page-slide" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>
<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

#app {
  height: 100%;
}

/* 公共搜索区域样式 */
.search-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 15px;
  border: 1px solid rgb(219, 223, 233);
}

.search-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.el-main {
  display: flex;
  height: 100%;
  flex-direction: column;
}

/* 公共表格区域样式 */
.table-section {
  background: #fff;
  border-radius: 15px;
  padding: 20px;
  border: 1px solid rgb(219, 223, 233);
}

.pagination-section {
  margin-top: 20px;
  padding: 20px;
  background: #fff;
  border-radius: 15px;
  border: 1px solid rgb(219, 223, 233);
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.pagination-section .el-pagination {
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
}

.pagination-section .el-pagination .el-pagination__total {
  flex-shrink: 0;
}

.pagination-section .el-pagination .el-pagination__sizes {
  flex-shrink: 0;
}

.pagination-section .el-pagination .el-pagination__jump {
  flex-shrink: 0;
}

.pagination-section .el-pagination .el-pagination__rightwrapper {
  flex-shrink: 0;
}


/* 弹窗自适应 */
.el-dialog {
  width: var(--el-dialog-width, 50%) !important;
  max-width: min(90vw, 560px) !important;
}

.el-drawer {
  width: var(--el-drawer-size, 30%) !important;
  max-width: min(90vw, 500px) !important;
}

@media (max-width: 768px) {
  .search-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .page-container {
    padding: 16px;
  }

  .table-section {
    padding: 16px;
  }

  .el-dialog {
    width: 92vw !important;
    max-width: 92vw !important;
  }

  .el-drawer {
    width: 92vw !important;
    max-width: 92vw !important;
  }
}
</style>