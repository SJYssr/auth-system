/**
 * SDK 自动生成器
 *
 * 读取 docs/openapi.json，基于模板生成多语言客户端 SDK。
 * 当前支持：Python、Go、Node.js
 *
 * 用法：
 *   node scripts/generate-sdk.js              # 生成全部语言
 *   node scripts/generate-sdk.js python       # 仅生成 Python
 *   node scripts/generate-sdk.js go           # 仅生成 Go
 *
 * 也可通过管理 API POST /api/admin/sdk/generate 触发。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SPEC_PATH = path.join(ROOT, 'docs', 'openapi.json');
const OUTPUT_DIR = path.join(ROOT, 'sdk');

// ---------- 工具函数 ----------

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toPascalCase(s) {
  return s.split(/[-_]/).map(capitalize).join('');
}

/** 从 OpenAPI 操作中提取方法名 */
function methodName(pathKey, _method) {
  // /login → login, /heartbeat → heartbeat
  const clean = pathKey.replace(/^\//, '').replace(/[{}]/g, '');
  return toPascalCase(clean) || 'Index';
}

/** 收集 spec 中所有操作 */
function collectOperations(spec) {
  const ops = [];
  for (const [pathKey, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (method === 'parameters') continue;
      const reqSchemaRef = operation.requestBody?.content?.['application/json']?.schema?.$ref;
      const reqSchemaName = reqSchemaRef ? reqSchemaRef.split('/').pop() : null;
      const reqSchema = reqSchemaName ? spec.components?.schemas?.[reqSchemaName] : null;
      const props = reqSchema?.properties || {};
      const required = reqSchema?.required || [];

      ops.push({
        path: pathKey,
        method: method.toUpperCase(),
        operationId: operation.operationId || methodName(pathKey, method),
        summary: operation.summary || '',
        tag: (operation.tags || ['default'])[0],
        requestFields: Object.entries(props).map(([name, schema]) => ({
          name,
          type: schema.type || (schema.$ref ? schema.$ref.split('/').pop() : 'string'),
          required: required.includes(name),
          description: schema.description || '',
          example: schema.example || ''
        })),
        responseSchema: operation.responses?.['200']?.content?.['application/json']?.schema
      });
    }
  }
  return ops;
}

// ---------- Python 生成器 ----------

function generatePython(spec, operations) {
  const className = 'AuthSystemClient';
  const lines = [
    '"""',
    `# ${spec.info.title}`,
    `# 版本: ${spec.info.version}`,
    `# 自动生成 — 请勿手动编辑`,
    '"""',
    '',
    'import requests',
    'from typing import Optional, Dict, Any',
    '',
    '',
    `class ${className}:`,
    `    """${spec.info.description || ''}"""`,
    '',
    '    def __init__(self, base_url: str, timeout: int = 10):',
    '        self.base_url = base_url.rstrip("/")',
    '        self.timeout = timeout',
    '        self.session = requests.Session()',
    '        self.session.headers.update({"Content-Type": "application/json"})',
    '',
    '    def _post(self, path: str, data: Dict[str, Any]) -> Dict[str, Any]:',
    '        url = self.base_url + path',
    '        resp = self.session.post(url, json=data, timeout=self.timeout)',
    '        return resp.json()',
    ''
  ];

  for (const op of operations) {
    const params = op.requestFields.map(f => {
      const annotation = f.required ? f.name : `${f.name}=None`;
      return annotation;
    }).join(', ');
    const bodyFields = op.requestFields.map(f => `"${f.name}": ${f.name}`).join(', ');
    const docLines = op.requestFields.map(f =>
      `        ${f.name}: ${f.description || f.type}${f.required ? ' (必填)' : ''}`
    ).join('\n');

    lines.push(`    def ${op.operationId}(self, ${params}):`);
    lines.push(`        """${op.summary}"""`);
    if (docLines) lines.push(docLines);
    if (op.requestFields.length > 0) {
      lines.push(`        return self._post("${op.path}", {${bodyFields}})`);
    } else {
      lines.push(`        return self._post("${op.path}", {})`);
    }
    lines.push('');
  }

  lines.push('');
  return lines.join('\n');
}

// ---------- Go 生成器 ----------

function goType(jsonType) {
  const map = { string: 'string', integer: 'int', number: 'float64', boolean: 'bool', array: '[]interface{}', object: 'map[string]interface{}' };
  return map[jsonType] || 'string';
}

function generateGo(spec, operations) {
  const structName = 'AuthSystemClient';
  const lines = [
    `// ${spec.info.title}`,
    `// 版本: ${spec.info.version}`,
    `// 自动生成 — 请勿手动编辑`,
    '',
    'package authsystem',
    '',
    'import (',
    '	"bytes"',
    '	"encoding/json"',
    '	"fmt"',
    '	"io"',
    '	"net/http"',
    '	"time"',
    ')',
    '',
    `type ${structName} struct {`,
    '	BaseURL string',
    '	Timeout time.Duration',
    '	client  *http.Client',
    '}',
    '',
    `func New${structName}(baseURL string) *${structName} {`,
    `	return &${structName}{`,
    '		BaseURL: baseURL,',
    '		Timeout: 10 * time.Second,',
    '		client:  &http.Client{Timeout: 10 * time.Second},',
    '	}',
    '}',
    '',
    'func (c *AuthSystemClient) post(path string, body map[string]interface{}) (map[string]interface{}, error) {',
    '	jsonBody, _ := json.Marshal(body)',
    '	url := c.BaseURL + path',
    '	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))',
    '	if err != nil {',
    '		return nil, err',
    '	}',
    '	req.Header.Set("Content-Type", "application/json")',
    '	resp, err := c.client.Do(req)',
    '	if err != nil {',
    '		return nil, err',
    '	}',
    '	defer resp.Body.Close()',
    '	data, _ := io.ReadAll(resp.Body)',
    '	var result map[string]interface{}',
    '	if err := json.Unmarshal(data, &result); err != nil {',
    '		return nil, fmt.Errorf("解析响应失败: %w", err)',
    '	}',
    '	return result, nil',
    '}',
    ''
  ];

  for (const op of operations) {
    const funcName = capitalize(op.operationId);
    const params = op.requestFields.map(f => {
      const goT = goType(f.type);
      return `${f.name} ${goT}`;
    }).join(', ');
    const bodyMap = op.requestFields.map(f =>
      `"${f.name}": ${f.name}`
    ).join(', ');

    lines.push(`// ${op.summary}`);
    lines.push(`func (c *${structName}) ${funcName}(${params}) (map[string]interface{}, error) {`);
    if (op.requestFields.length > 0) {
      lines.push(`	return c.post("${op.path}", map[string]interface{}{${bodyMap}})`);
    } else {
      lines.push(`	return c.post("${op.path}", map[string]interface{}{})`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------- Node.js 生成器 ----------

function generateNode(spec, operations) {
  const className = 'AuthSystemClient';
  const lines = [
    `/**`,
    ` * ${spec.info.title}`,
    ` * 版本: ${spec.info.version}`,
    ` * 自动生成 — 请勿手动编辑`,
    ` */`,
    '',
    `'use strict';`,
    '',
    `class ${className} {`,
    `  /**`,
    `   * @param {string} baseURL - API 基地址`,
    `   * @param {object} [opts] - { timeout: number }`,
    `   */`,
    '  constructor(baseURL, opts = {}) {',
    '    this.baseURL = baseURL.replace(/\\/$/, "");',
    '    this.timeout = opts.timeout || 10000;',
    '  }',
    '',
    '  async _post(path, body) {',
    '    const ctrl = new AbortController();',
    '    const timer = setTimeout(() => ctrl.abort(), this.timeout);',
    '    try {',
    '      const resp = await fetch(this.baseURL + path, {',
    '        method: "POST",',
    '        headers: { "Content-Type": "application/json" },',
    '        body: JSON.stringify(body),',
    '        signal: ctrl.signal,',
    '      });',
    '      return await resp.json();',
    '    } finally {',
    '      clearTimeout(timer);',
    '    }',
    '  }',
    ''
  ];

  for (const op of operations) {
    const params = op.requestFields.map(f => f.name).join(', ');
    const bodyObj = op.requestFields.length > 0
      ? `{ ${op.requestFields.map(f => `"${f.name}": ${f.name}`).join(', ')} }`
      : '{}';
    const jsdoc = op.requestFields.map(f =>
      `   * @param {${f.type === 'integer' ? 'number' : f.type}} ${f.name}${f.required ? '' : ' [可选]'} - ${f.description || ''}`
    ).join('\n');

    lines.push(`  /**`);
    lines.push(`   * ${op.summary}`);
    if (jsdoc) lines.push(jsdoc);
    lines.push(`   * @returns {Promise<object>} 响应 JSON`);
    lines.push(`   */`);
    lines.push(`  async ${op.operationId}(${params}) {`);
    lines.push(`    return this._post("${op.path}", ${bodyObj});`);
    lines.push(`  }`);
    lines.push('');
  }

  lines.push('}');
    lines.push('');
  lines.push(`module.exports = { ${className} };`);
  return lines.join('\n');
}

// ---------- 主逻辑 ----------

const GENERATORS = {
  python: { ext: '.py', dir: 'python', filename: 'authsystem_client', generate: generatePython },
  go: { ext: '.go', dir: 'go', filename: 'authsystem_client', generate: generateGo },
  node: { ext: '.js', dir: 'node', filename: 'authsystem_client', generate: generateNode },
};

function generateSDK(language) {
  const specRaw = fs.readFileSync(SPEC_PATH, 'utf-8');
  const spec = JSON.parse(specRaw);
  const operations = collectOperations(spec);

  const gen = GENERATORS[language];
  if (!gen) throw new Error(`不支持的语言: ${language}（可选: ${Object.keys(GENERATORS).join(', ')}）`);

  const code = gen.generate(spec, operations);
  const outDir = path.join(OUTPUT_DIR, gen.dir);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, gen.filename + gen.ext);
  fs.writeFileSync(outFile, code, 'utf-8');

  return { language, path: outFile, operations: operations.length, bytes: code.length };
}

function generateAll() {
  const results = [];
  for (const lang of Object.keys(GENERATORS)) {
    results.push(generateSDK(lang));
  }
  return results;
}

// CLI 入口
if (require.main === module) {
  const lang = process.argv[2];
  try {
    if (lang) {
      const r = generateSDK(lang);
      console.log(`✓ ${r.language}: ${r.path} (${r.operations} 个接口, ${r.bytes} 字节)`);
    } else {
      const results = generateAll();
      for (const r of results) {
        console.log(`✓ ${r.language}: ${r.path} (${r.operations} 个接口, ${r.bytes} 字节)`);
      }
      console.log(`\n共生成 ${results.length} 个 SDK`);
    }
  } catch (err) {
    console.error(`✗ 生成失败: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { generateSDK, generateAll, collectOperations };
