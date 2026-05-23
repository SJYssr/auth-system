/**
 * 统一响应工具
 */

/** 成功响应 */
function success(data = null, message = '操作成功') {
  const res = { success: true, message };
  if (data !== null) res.data = data;
  return res;
}

/** 错误响应 */
function error(message = '操作失败', errcode = null) {
  const res = { success: false, message };
  if (errcode !== null) res.errcode = errcode;
  return res;
}

/** 分页响应（兼容前端字段名） */
function paginated(data, pagination) {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page,
      current: pagination.page,
      per_page: pagination.pageSize,
      pageSize: pagination.pageSize,
      total: pagination.total,
      total_records: pagination.total,
      total_pages: Math.ceil(pagination.total / pagination.pageSize)
    }
  };
}

/** 解析分页参数（兼容 pageSize/per_page） */
function parsePagination(query) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || parseInt(query.per_page) || 20;
  return { page, pageSize };
}

module.exports = { success, error, paginated, parsePagination };
