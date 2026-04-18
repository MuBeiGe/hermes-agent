# Hermes v0.9.0 升级评估报告
**日期**: 2026-04-16
**评估人**: 曜（星辰化身）

---

## 一、核心结论

### 升级已完成

运行实例 `~/.hermes/hermes-agent/` 已经是 v0.9.0 + 本地补丁的合并版本。
- **0 commits behind** origin/main
- **5 commits ahead**（本地机制commits）
- HEAD: `263e93a5` — "v0.9.0 upgrade: merge local-patches with all mechanisms"
- `__version__` = `0.9.0`

### Memory中的旧记录需要纠正

旧memory说"366 commits已合并到main，8个本地机制A-H全部存活验证通过"。
**实际情况**: 7/8存活，机制A（_diag_log guard logger）未合并。

---

## 二、两个仓库的真相

| 项目 | `~/hermes-agent/` | `~/.hermes/hermes-agent/` |
|------|-------------------|---------------------------|
| 角色 | 非运行（可能是升级测试目录） | **运行实例**（PID 68） |
| HEAD | `1af2e18d` (v0.9.0 tag, detached) | `263e93a5` (merge commit) |
| 分支 | detached HEAD | main (ahead 5) |
| Behind | 166 commits behind origin/main | **0 commits behind** |
| 本地补丁 | 无（在stash中） | **已合并**（7/8机制存活） |
| Stash | 2个stash | 无stash |

---

## 三、本地机制存活矩阵

| 机制 | 描述 | 存活 | 备注 |
|------|------|------|------|
| A. _diag_log | 独立诊断日志(guard.log) | ❌ 未合并 | v0.9.0有自己的logging改进 |
| B. cooldown | Fallback cooldown防429轰炸 | ✅ 35处引用 | v0.9.0也有fallback改进，但本地cooldown逻辑保留 |
| C. archive | 压缩前/flush时对话存档 | ✅ 4处引用 | _archive_pre_compression + _archive_flush_fallback |
| D. early-exit guard | 防止agent过早退出 | ✅ 4处引用 | suspicious_exit检测 + 强制继续 |
| E. HARD RULES | 4条工具使用强制规则 | ✅ 1处 | prompt_builder.py中保留 |
| F. glm enforcement | glm加入强制执行模型列表 | ✅ | "glm"在TOOL_USE_ENFORCEMENT_MODELS中 |
| G. dream-memory | 压缩器集成dream-memory | ✅ 6处引用 | context_compressor.py中 |
| H. _verification | Hook返回值注入验证字段 | ✅ 1处 | model_tools.py中 |

**额外本地commits**（非A-H机制）:
- `cf087343` agent-rule-enforcement: Pre-Write Gate + Verification Gate
- `3bd178a5` patch_tool: BLOCKING syntax gate — set error field on py_compile failure

---

## 四、上游v0.9.0核心变更（160个非merge commits分类）

### 架构级变更（直接影响本地机制兼容性）

| 变更 | Commit | 与本地机制关系 |
|------|--------|----------------|
| **context_compressor重大重写** | `9855190f` — smart collapse/dedup/anti-thrashing | 与机制G(dream-memory)相关，已兼容合并 |
| **工具自动发现重构** | `4b2a1a43` — registry.py新增45行 | 与机制H(_verification)相关，已兼容合并 |
| **Gateway自动恢复中断工作** | `e7475b15` | 新feature，不影响本地机制 |
| **用户消息立即中断agent** | `a8b7db35` | 与机制D(early-exit)互补 |
| **死代码清理(1,784行)** | `8d023e43` — 77 files | 已验证本地机制未被误删 |
| **Plugin pre_tool_call hook** | `eabc0a2f` | 与机制H相关，已兼容 |

### 重要新Features

- **Web Dashboard** — React UI管理界面（i18n, 响应式）
- **QQ Bot平台** — Official API v2适配器
- **Gateway Proxy模式** — 转发到远程API服务器
- **Podman支持** — rootless容器
- **Dynamic shell completion** — bash/zsh/fish
- **hermes backup/import** — 快照备份恢复
- **/compress <focus>** — 指导式压缩
- **Arcee AI / xAI / Xiaomi MiMo** — 新provider支持

### 关键Bug修复（Security & Stability）

- 供应链加固（CI pinning, dep pinning）
- Dashboard API未授权访问修复
- API key非ASCII字符检测/剥离
- Agent阻止自毁gateway
- 压缩耗尽无限循环修复
- 粘滞session恢复循环修复
- vLLM/local server错误模式 + MCP连接重试

---

## 五、遗留问题

### 1. 机制A（_diag_log guard logger）未存活

stash@{0}中包含 `_diag_log = logging.getLogger("hermes.guard")` 和 guard.log FileHandler。
v0.9.0的运行实例中完全没有这段代码。
**影响**: 低。v0.9.0有自己的logging改进(component-separated logging with session context)。
**建议**: 评估是否需要手动补回，或接受v0.9.0的原生logging。

### 2. ~/hermes-agent/ 目录的处置

此目录HEAD detached在v0.9.0 tag上，166 commits behind，包含2个stash。
**建议**:
- 如果是升级测试目录 → 可以安全删除
- 如果是备份 → 保留但标记用途

### 3. 166 commits的增量升级

运行实例0 behind，但~/hermes-agent/有166个新commits未包含。
这些是v0.9.0 tag之后的新开发。**运行实例不需要这些commits**。

---

## 六、升级策略建议

### 当前状态：✅ 升级已完成

运行实例已经是v0.9.0 + 本地补丁的完整合并版本。
不需要再执行升级操作。

### 可选后续动作

1. **补回机制A**（优先级P3）:
   - 从stash@{0}提取_diag_log代码
   - 手动应用到运行实例
   - 或者接受v0.9.0原生logging

2. **清理~/hermes-agent/**（优先级P4）:
   - 确认此目录用途
   - 如果不再需要，归档或删除

3. **推送到远程**（需主人决定）:
   - 5个本地commits可以push到fork
   - 或保持本地only

### 回滚方案

如果需要回滚到v0.8.x:
- `git reset --hard 3bd178a5`（升级前main的HEAD，也是5个local commits的前一个）

---

*报告完毕。曜等待主人指示。*
