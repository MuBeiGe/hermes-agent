# Hermes Agent 深化安全审计报告

审计时间: 2026-04-16
审计范围: `/home/byyg/.hermes/hermes-agent/`

---

## 维度1: 网络调用审计

### 已确认的网络端点

| 端点 | 文件:行号 | 用途 | 风险等级 |
|------|-----------|------|---------|
| `https://openrouter.ai/api/v1` | run_agent.py:1120, batch_runner.py, hermes_constants.py:291 | 模型API调用 | LOW |
| `https://ai-gateway.vercel.sh/v1` | hermes_constants.py:294, models.py:1729 | AI Gateway模型列表 | MED |
| `https://inference-api.nousresearch.com/v1` | auth.py:63, providers.py:54 | Nous API | LOW |
| `https://api.anthropic.com/v1/models` | models.py:1297, doctor.py:786 | Anthropic模型列表 | LOW |
| `https://paste.rs/` | hermes_cli/debug.py:23 | debug share上传 | **HIGH** |
| `https://dpaste.com/api/` | hermes_cli/debug.py:24 | debug share备用 | **HIGH** |
| `https://api.firecrawl.dev` | tools/browser_providers/firecrawl.py:14 | Firecrawl浏览器 | MED |
| `https://firecrawl-gateway.nousresearch.com` | tools/managed_tool_gateway.py:129 | Nous订阅者工具网关 | MED |
| `https://api.supermemory.ai/v4/conversations` | plugins/memory/supermemory/__init__.py:34 | Supermemory插件 | **HIGH** |
| `https://dns.google/resolve` | optional-skills/research/domain-intel/scripts/domain_intel.py:233,261 | DNS查询 | LOW |
| `https://crt.sh/?q=%.{domain}&output=json` | optional-skills/.../domain_intel.py:32 | 证书透明度日志 | LOW |
| `https://pubchem.ncbi.nlm.nih.gov/rest/pug/` | optional-skills/.../ro5_screen.py:10 | 药物发现 | LOW |
| `https://api.github.com/repos/{owner}/{repo}/...` | hermes_cli/skills_hub.py:809-877 | GitHub API | LOW |
| `https://chatgpt.com/backend-api/codex/models` | hermes_cli/codex_models.py:60 | Codex模型列表 | LOW |
| `https://api.coingecko.com/api/v3/` | optional-skills/blockchain/*/scripts/*.py | 加密货币API | LOW |
| `https://api.imgflip.com/get_memes` | optional-skills/creative/meme-generation/scripts/generate_meme.py:35 | Meme生成 | LOW |
| `https://api.twilio.com/` | optional-skills/productivity/telephony/scripts/telephony.py:35 | 电话API | LOW |
| `https://api.vapi.ai`, `https://api.bland.ai` | optional-skills/.../telephony.py:36-37 | 语音API | LOW |
| `https://api.z.ai/api/paas/v4` | auth.py:151 | 智谱AI | LOW |
| `https://open.bigmodel.cn/api/paas/v4` | auth.py:393 | 智谱AI中国 | LOW |

### 发现

- **hermes_cli/debug.py:23,87-108**: `hermes debug share` 将debug报告（包含系统信息、日志）上传到 `paste.rs` 或 `dpaste.com`，这是**已知低风险项**
- **plugins/memory/supermemory/__init__.py:34**: Supermemory插件将对话数据发送到 `api.supermemory.ai` — **需用户确认授权**

---

## 维度2: 遥测/追踪代码

### 已确认: 无第三方遥测服务

搜索 `posthog|amplitude|sentry|bugsnag|segment|mixpanel|heap\.io|hotjar` — **未发现**任何第三方遥测SDK集成。

### 已确认: 日志系统

- `hermes_logging.py` — 本地日志记录到 `~/.hermes/logs/`
- 日志模块: `logging.handlers.RotatingFileHandler`
- 日志路径: `agent.log`, `gateway.log`, `errors.log`

### 发现

- `batch_runner.py:441-443`: 轨迹统计数据用于内部分析，不涉及外部传输
- `hermes_cli/tips.py:299-303`: CLI提示信息中的调试功能说明

---

## 维度3: 文件访问审计

### 敏感文件保护（已实施）

| 文件 | 保护位置 | 状态 |
|------|---------|------|
| `~/.ssh/id_rsa`, `~/.ssh/id_ed25519` | tools/file_operations.py:48-49, tools/credential_files.py:64-84, agent/context_references.py:24-27 | ✅ 有写保护 |
| `~/.ssh/authorized_keys` | tools/file_operations.py:47 | ✅ 有写保护 |
| `~/.ssh/config` | tools/file_operations.py:50 | ✅ 有写保护 |
| `~/.bashrc`, `~/.zshrc`, `~/.profile` | tools/file_operations.py:52-54, agent/context_references.py:28-30 | ✅ 有读保护 |
| `~/.hermes/.env` | tools/file_operations.py:51 | ✅ 有保护 |

### 测试验证

- `tests/tools/test_file_read_guards.py`: 读取保护测试
- `tests/tools/test_file_write_safety.py:21-23`: SSH密钥写入拒绝测试

### 发现

- `hermes_cli/setup.py:1360-1362`: 交互式设置时提示输入SSH密钥路径（用户自愿提供）
- `hermes_cli/backup.py:425-429`: 提示修改 `~/.bashrc` 添加PATH（用户自愿操作）

---

## 维度4: 外部通信（WebSocket/DNS/长连接）

### 已确认的外部通信

| 类型 | 端点/模式 | 文件:行号 | 风险等级 |
|------|----------|----------|---------|
| 模型API | OpenRouter (HTTPS) | run_agent.py:1120 | LOW |
| 模型API | Nous Gateway (HTTPS) | auth.py:63 | LOW |
| 工具网关 | Firecrawl Gateway (HTTPS) | managed_tool_gateway.py:129 | MED |
| 第三方工具 | Firecrawl/Parallel/Tavily/Exa | tools/web_tools.py:97-101 | MED |
| 云浏览器 | Browserbase WebSocket | tools/browser_providers/browserbase.py | MED |
| 云浏览器 | Firecrawl Cloud Browser | tools/browser_providers/firecrawl.py | MED |
| 云浏览器 | Browser-Use | tools/browser_providers/browser_use.py | MED |
| AI Gateway | Vercel AI Gateway | hermes_constants.py:294, models.py:1729 | MED |

### 排除项（本地/已知）

- ✅ `localhost:30000` — 本地OV2 gateway (run_agent.py:19)
- ✅ `http://127.0.0.1:8080` — 本地webhook (hermes_cli/gateway.py:2610)
- ✅ `http://127.0.0.1:1933` — OpenViking本地服务 (plugins/memory/openviking/__init__.py:11)
- ✅ `ws://localhost:9222` — 本地CDP浏览器调试 (cli.py:5959)

### WebSocket 发现

- `tools/browser_tool.py:215-238`: 支持WebSocket连接到云浏览器提供商
- `gateway/platforms/wecom.py:964-966`: WeCom使用WebSocket发送管道
- `gateway/platforms/telegram.py`: Telegram Bot API (REST, 非WebSocket)
- `gateway/platforms/discord.py`: Discord REST API

### DNS 发现

- `optional-skills/research/domain-intel/`: 调用 `dns.google/resolve` — 明确用户意图的安全研究工具

---

## 维度5: MCP数据流

### MCP Server (Hermes作为MCP Server)

`mcp_serve.py:1-26`: Hermes作为MCP服务器，通过stdio与MCP客户端通信。

**工具列表** (mcp_serve.py):
- `conversations_list` — 列出对话
- `conversation_get` — 获取对话详情
- `messages_read` — 读取消息
- `attachments_fetch` — 获取附件
- `events_poll`, `events_wait` — 事件轮询
- `messages_send` — 发送消息
- `permissions_list_open` — 权限列表

**数据流**: MCP客户端 → Hermes stdio → 本地处理，不涉及外部网络。

### MCP Client (Hermes调用外部MCP)

`tools/mcp_tool.py:87732行`: Hermes作为MCP客户端调用外部MCP服务器。

### Firecrawl MCP

**直接模式** (tools/web_tools.py:128-142):
- `FIRECRAWL_API_KEY` → `https://api.firecrawl.dev`

**托管网关模式** (tools/web_tools.py:145-152):
- `FIRECRAWL_GATEWAY_URL` 或 `TOOL_GATEWAY_DOMAIN=nousresearch.com` → `https://firecrawl-gateway.nousresearch.com`
- 通过 `resolve_managed_tool_gateway("firecrawl")` 获取 Nous OAuth token

**数据流**:
```
用户查询 → Hermes Agent 
  → Firecrawl API (直接模式) 或 
  → Firecrawl Gateway @ nousresearch.com (托管模式)
  → 返回抓取的网页内容
```

### 其他MCP服务器

- `hermes_cli/mcp_config.py:252`: Ink MCP `https://mcp.ml.ink/mcp`
- 用户配置的第三方MCP服务器

---

## 综合风险评估

### 高风险 (HIGH)

1. **Debug Share上传到paste.rs** (`hermes_cli/debug.py:23,87-108`)
   - 风险: 系统信息、日志被上传到第三方服务
   - 缓解: 默认不启用，需用户主动调用 `hermes debug share`
   - 建议: 添加 `--local` 选项或明确警告用户

2. **Supermemory插件外部通信** (`plugins/memory/supermemory/__init__.py:34`)
   - 风险: 对话数据发送到 `api.supermemory.ai`
   - 缓解: 需用户安装并启用插件
   - 建议: 明确告知用户数据外传风险

3. **Trajectory明文存储** (`agent/trajectory.py:52`)
   - 风险: 使用**相对路径** `trajectory_samples.jsonl` 保存到当前工作目录
   - 影响: 在共享目录运行时可能暴露对话历史
   - 缓解: 默认禁用 (`save_trajectories=False`)
   - 建议: 使用绝对路径保存到 `~/.hermes/trajectories/`

### 中风险 (MED)

4. **Nous工具网关** (`tools/managed_tool_gateway.py:117-129`)
   - 风险: Firecrawl等工具通过 `firecrawl-gateway.nousresearch.com` 路由
   - 缓解: 仅影响启用 Nous 订阅的用户
   - 数据: 工具使用数据（URL查询等）

5. **AI Gateway模型列表** (`hermes_cli/models.py:1729`)
   - 风险: 发送API密钥到 Vercel AI Gateway
   - 缓解: 可通过 `AI_GATEWAY_API_KEY` 环境变量控制

6. **云浏览器Provider**
   - Browserbase/Firecrawl/Browser-Use: 通过WebSocket连接云服务
   - 数据: 浏览器指纹、浏览内容

### 低风险 (INFO)

7. **OpenViking本地服务**: 仅本地 `localhost:1933` 通信
8. **OV2本地Gateway**: `localhost:30000`
9. **DNS查询** (domain-intel技能): 用户主动使用的安全研究工具
10. **GitHub API**: Skills Hub功能，需用户GitHub Token
11. **加密货币/药物发现API**: 可选的第三方集成

---

## 已确认的安全措施

1. ✅ 敏感文件读/写保护 (`file_operations.py`, `credential_files.py`)
2. ✅ 路径遍历防护 (`path_security.py`)
3. ✅ 无第三方遥测SDK
4. ✅ Trajectory默认禁用
5. ✅ Debug share需用户主动调用
6. ✅ MCP数据本地处理（不外传）

---

## 建议

1. **HIGH**: 修改 `agent/trajectory.py:52` 使用绝对路径 `~/.hermes/trajectories/`
2. **HIGH**: Debug share添加更明确的用户警告
3. **MED**: 文档中明确说明Nous工具网关的数据流
4. **MED**: Supermemory插件添加数据外传警告
5. **LOW**: 考虑为云浏览器Provider添加更细粒度的数据控制
