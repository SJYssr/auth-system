// 注入钩子：让 captchaService.verify 恒真（仅用于 e2e 测试桩实例，不改仓库代码）
const Module = require('module');
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const exports = origLoad.apply(this, arguments);
  if (request.endsWith('captchaService') && exports && typeof exports.verify === 'function') {
    return Object.assign({}, exports, { verify: () => true });
  }
  return exports;
};
