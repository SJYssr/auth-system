/**
 * 可观测性中间件
 *
 * 1. request_id：每个请求分配唯一 ID，贯穿日志/响应头
 * 2. 结构化日志：Pino 风格 JSON 日志（request_id, user_id, app_id, latency, error_code）
 * 3. Prometheus metrics：HTTP QPS, P95 latency, login_failure_total, license_activation_total
 */

const crypto = require('crypto');

/** 生成短 request_id（12 字符 hex） */
function generateRequestId() {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * request_id 中间件：分配唯一 ID 并挂到 req 对象
 */
function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers['x-request-id'] || generateRequestId();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/**
 * 结构化日志中间件：记录每个请求的方法/路径/状态/耗时/request_id
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const { method } = req;
  // 过滤敏感查询参数
  const url = new URL(req.originalUrl || req.url, 'http://localhost');
  for (const key of url.searchParams.keys()) {
    if (['token', 'password', 'secret', 'key'].includes(key.toLowerCase())) {
      url.searchParams.set(key, '***');
    }
  }
  const path = url.pathname + url.search;

  res.on('finish', () => {
    const latency = Date.now() - start;
    const log = {
      ts: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      request_id: req.requestId,
      method,
      path,
      status: res.statusCode,
      latency_ms: latency,
      ip: (req.ip || '').replace(/^::ffff:/, ''),
      user_id: req.currentUser?.id || null,
      user_agent: req.headers['user-agent'] || null
    };
    // JSON 结构化输出到 stdout（可被 Loki/Promtail 采集）
    console.log(JSON.stringify(log));
  });

  next();
}

/**
 * Prometheus 指标收集器（进程内计数，通过 /metrics 端点暴露）
 */
const metrics = {
  httpRequestsTotal: new Map(),       // route → count
  httpLatencyBuckets: new Map(),      // route → [latency_ms...]
  loginFailures: 0,
  loginSuccesses: 0,
  cardActivations: 0,
  webhookPending: 0,
  webhookFailed: 0,
  startTime: Date.now()
};

/** 记录 HTTP 请求 */
function recordHttpRequest(method, path, statusCode, latencyMs) {
  const key = `${method} ${path}`;
  metrics.httpRequestsTotal.set(key, (metrics.httpRequestsTotal.get(key) || 0) + 1);
  if (!metrics.httpLatencyBuckets.has(key)) metrics.httpLatencyBuckets.set(key, []);
  const buckets = metrics.httpLatencyBuckets.get(key);
  buckets.push(latencyMs);
  // 只保留最近 1000 条用于 P95 计算
  if (buckets.length > 1000) buckets.shift();
}

/** 记录登录结果 */
function recordLogin(success) {
  if (success) metrics.loginSuccesses++;
  else metrics.loginFailures++;
}

/** 记录卡密激活 */
function recordCardActivation() {
  metrics.cardActivations++;
}

/** 记录 webhook 状态 */
function recordWebhookStatus(status) {
  if (status === 'pending') metrics.webhookPending++;
  else if (status === 'failed') metrics.webhookFailed++;
}

/** 计算 P95 延迟 */
function p95(latencies) {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[Math.max(idx, 0)];
}

/**
 * 生成 Prometheus 格式的 metrics 文本
 */
function prometheusMetrics() {
  const lines = [];
  const uptime = (Date.now() - metrics.startTime) / 1000;

  lines.push(`# HELP process_uptime_seconds Process uptime`);
  lines.push(`# TYPE process_uptime_seconds gauge`);
  lines.push(`process_uptime_seconds ${uptime}`);

  lines.push(`# HELP http_requests_total Total HTTP requests`);
  lines.push(`# TYPE http_requests_total counter`);
  for (const [key, count] of metrics.httpRequestsTotal) {
    lines.push(`http_requests_total{route="${key}"} ${count}`);
  }

  lines.push(`# HELP http_request_duration_p95_ms P95 latency in milliseconds`);
  lines.push(`# TYPE http_request_duration_p95_ms gauge`);
  for (const [key, buckets] of metrics.httpLatencyBuckets) {
    lines.push(`http_request_duration_p95_ms{route="${key}"} ${p95(buckets)}`);
  }

  lines.push(`# HELP login_failures_total Total failed logins`);
  lines.push(`# TYPE login_failures_total counter`);
  lines.push(`login_failures_total ${metrics.loginFailures}`);

  lines.push(`# HELP login_successes_total Total successful logins`);
  lines.push(`# TYPE login_successes_total counter`);
  lines.push(`login_successes_total ${metrics.loginSuccesses}`);

  lines.push(`# HELP card_activations_total Total card activations`);
  lines.push(`# TYPE card_activations_total counter`);
  lines.push(`card_activations_total ${metrics.cardActivations}`);

  lines.push(`# HELP webhook_pending_total Pending webhook deliveries`);
  lines.push(`# TYPE webhook_pending_total counter`);
  lines.push(`webhook_pending_total ${metrics.webhookPending}`);

  lines.push(`# HELP webhook_failed_total Failed webhook deliveries`);
  lines.push(`# TYPE webhook_failed_total counter`);
  lines.push(`webhook_failed_total ${metrics.webhookFailed}`);

  return lines.join('\n') + '\n';
}

/**
 * metrics 收集中间件：记录每个请求的 QPS 和延迟
 */
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const latency = Date.now() - start;
    const path = new URL(req.originalUrl || req.url, 'http://localhost').pathname;
    recordHttpRequest(req.method, path, res.statusCode, latency);
  });
  next();
}

module.exports = {
  requestIdMiddleware,
  requestLogger,
  metricsMiddleware,
  prometheusMetrics,
  recordHttpRequest,
  recordLogin,
  recordCardActivation,
  recordWebhookStatus,
  generateRequestId
};