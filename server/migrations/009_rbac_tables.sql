-- 009_rbac_tables.sql
-- RBAC 角色权限模型：从 SuperAdmin/Admin 两级升级为角色权限体系

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(64) NOT NULL UNIQUE COMMENT '角色标识，如 superadmin/operator/support/developer/auditor',
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system TINYINT NOT NULL DEFAULT 0 COMMENT '系统内置角色不可删除',
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(128) NOT NULL UNIQUE COMMENT '权限码，如 app:view / card:create / card:unbind',
    name VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL COMMENT '所属模块：apps/cards/admins/webhooks/logs/...',
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 管理员-角色关联表（一个管理员可拥有多个角色）
CREATE TABLE IF NOT EXISTS admin_roles (
    admin_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (admin_id, role_id),
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 内置角色
INSERT IGNORE INTO roles (id, name, display_name, description, is_system, sort_order) VALUES
(1, 'superadmin', '超级管理员', '拥有全部权限', 1, 0),
(2, 'operator', '运营管理员', '应用与卡密管理、查看日志', 1, 10),
(3, 'support', '客服', '查看卡密、换绑设备、封禁/解封', 1, 20),
(4, 'developer', '开发', '应用管理、Webhook、版本管理', 1, 30),
(5, 'auditor', '审计员', '只读：查看日志、仪表盘、管理员列表', 1, 40);

-- 内置权限
INSERT IGNORE INTO permissions (id, code, name, module, description) VALUES
(1,  'app:view',       '查看应用',     'apps',     ''),
(2,  'app:create',     '创建应用',     'apps',     ''),
(3,  'app:update',     '更新应用',     'apps',     ''),
(4,  'app:delete',     '删除应用',     'apps',     ''),
(10, 'card:view',      '查看卡密',     'cards',    ''),
(11, 'card:create',    '生成卡密',     'cards',    ''),
(12, 'card:update',    '更新卡密',     'cards',    ''),
(13, 'card:delete',    '删除卡密',     'cards',    ''),
(14, 'card:disable',   '禁用卡密',     'cards',    ''),
(15, 'card:unbind',    '解绑/换绑设备', 'cards',   ''),
(16, 'card:export',    '导出卡密',     'cards',    ''),
(20, 'card:ban',       '封禁/解封',    'cards',    ''),
(30, 'admin:view',     '查看管理员',   'admins',   ''),
(31, 'admin:create',   '创建管理员',   'admins',   ''),
(32, 'admin:delete',   '删除管理员',   'admins',   ''),
(33, 'admin:limits',   '修改配额',     'admins',   ''),
(40, 'webhook:manage', '管理Webhook',  'webhooks', ''),
(41, 'webhook:view',   '查看Webhook',  'webhooks', ''),
(50, 'version:manage', '版本管理',     'versions', ''),
(60, 'log:view',       '查看日志',     'logs',     ''),
(61, 'log:cleanup',    '清理日志',     'logs',     ''),
(70, 'dashboard:view', '查看仪表盘',   'dashboard',''),
(80, 'license:manage', '授权方案管理', 'licenses', ''),
(81, 'license:view',   '查看授权',     'licenses', ''),
(90, 'site:update',    '网站配置',     'site',     ''),
(99, 'session:manage', '会话管理',     'sessions', '');

-- superadmin 拥有全部权限
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- operator 权限
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(2, 1), (2, 2), (2, 3), (2, 10), (2, 11), (2, 12), (2, 14), (2, 15),
(2, 40), (2, 41), (2, 50), (2, 60), (2, 70), (2, 80), (2, 81), (2, 99);

-- support 权限
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(3, 1), (3, 10), (3, 12), (3, 14), (3, 15), (3, 20), (3, 60), (3, 70), (3, 81);

-- developer 权限
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 40), (4, 41), (4, 50), (4, 70);

-- auditor 权限
INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
(5, 1), (5, 10), (5, 30), (5, 41), (5, 60), (5, 70), (5, 81);