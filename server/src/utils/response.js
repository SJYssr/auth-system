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

/** 分页响应 */
function paginated(data, pagination) {
  return { success: true, data, pagination };
}

module.exports = { success, error, paginated };
