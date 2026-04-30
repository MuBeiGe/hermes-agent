# OV 资源库 · 验收清单

> 每个 Phase 完成后，逐项打勾。全部通过才算"完成"。

## Phase 1 验收

### L1: 语法检查
- [ ] `python3 -m py_compile plugin_api.py` → exit 0
- [ ] `node --check dist/index.js` → exit 0

### L2: API 端到端
- [ ] `bash test_api.sh` → 全部通过（14/14）
- [ ] 至少 3 个端点返回真实数据（非空 result）

### L2: 前端注册
- [ ] `curl /api/dashboard/plugins/rescan` → {"ok":true}
- [ ] `curl /api/dashboard/plugins` → ov-console 在列表中

### L3: 仪表盘 tab
- [ ] 浏览器打开 Dashboard → 看到"仪表盘" tab
- [ ] 系统健康概览显示 observer 数据
- [ ] 最新会话列表显示最近 3 个 committed session
- [ ] 快捷入口按钮可见

### L3: 浏览 tab
- [ ] 点击"浏览" tab → 显示集合树
- [ ] 点击集合节点 → 展开子节点
- [ ] 点击文件 → 底部预览面板显示内容（abstract→overview→full）
- [ ] 右键菜单出现（编辑/删除/移动/复制URI/添加关联）
- [ ] grep/glob 搜索切换可用，返回有效结果

### L3: 搜索 tab
- [ ] 输入关键词搜索 → 返回结果列表
- [ ] QueryPlan 面板可折叠/展开
- [ ] 结果卡片显示关联资源
- [ ] 反馈按钮（👍/👎/➖）可点击，点击后突触强度更新
- [ ] 搜索范围筛选（全部/agent/resources/session）可用

### 主人验收
- [ ] 主人打开 Dashboard，确认三个 tab 功能正常
- [ ] 搜索结果的关联展示符合预期
- [ ] 反馈闭环可用（点 👍 后重新搜索，相关结果排名变化）

---

## Phase 2 验收

### L1/L2（同 Phase 1）

### L3: 图谱 tab
- [ ] 输入 URI → 显示该节点的关系图（SVG）
- [ ] 节点数 ≤30 时正常渲染，>30 时降级为列表
- [ ] 5 种边类型用不同颜色/线条区分
- [ ] 点击节点 → 以新节点为中心重新渲染
- [ ] 可手动添加/删除关联

### L3: 记忆 tab
- [ ] 以记忆类型筛选（profile/preferences/entities/events/cases/patterns/tools/skills）
- [ ] 每条记忆显示来源会话和突触强度
- [ ] 会话列表可折叠
- [ ] 记忆可点击跳转到对应资源

---

## 验收检查点（每次都做）

1. Dashboard 进程是否在运行？ → `ps aux | grep "hermes.*dashboard"`
2. OV Server 是否健康？ → `curl http://127.0.0.1:1933/health`
3. OV Console 是否可访问？ → `curl http://127.0.0.1:8020/health`
4. 浏览器缓存是否清除？ → Ctrl+Shift+R 强制刷新
