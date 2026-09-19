-- UI 冒烟测试种子数据：test-public.js 依赖 id=1 的应用名含「测试」，并需要应用文档渲染详情页
-- 用法：mysql ... auth-system < e2e-test/seed-ui-test.sql（幂等）
SET NAMES utf8mb4;

INSERT IGNORE INTO apps (id, softid, app_name, description, version, developer, status, announcement) VALUES
(1, '1460MREWAFMB3XQFEP', '测试应用一号', '面向个人开发者的软件授权方案', '1.0.0', '测试团队', 'enabled', '系统维护公告：周日 02:00-04:00'),
(2, 'ABCDEFGHIJKLMNOPQR', '测试工具箱', '多功能桌面工具集', '2.1.0', '测试团队', 'enabled', NULL);

INSERT IGNORE INTO app_docs (app_id, doc_type, title, content) VALUES
(1, 'intro', '产品介绍', '<h3>核心功能</h3><p>卡密授权、机器码绑定、在线续期。</p><ul><li>一键激活</li><li>离线校验</li></ul>'),
(1, 'deploy', '部署文档', '<h3>快速开始</h3><p>下载后解压运行 <code>setup.exe</code>。</p>');
