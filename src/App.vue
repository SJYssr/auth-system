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
}
</style>