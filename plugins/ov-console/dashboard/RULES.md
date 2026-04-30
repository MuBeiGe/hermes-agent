# OV 资源库 Dashboard 插件 · 项目规则

> 目的：让曜自己和子代理都能按照统一标准开发此插件。规则不自洽不开始写代码。

---

## 一、API 路由规范

### 1.1 路由命名
```
/{resource}[/{id}]/{action}?{query_params}
```
- 资源名用复数：`/sessions` 非 `/session`
- 动作用动词：`/relations/link` 非 `/relations/create`
- ID 在路径中：`/sessions/{session_id}/messages`
- 查询参数用 `Query()` 提取，body 用 `await request.json()`

### 1.2 代理架构
```
Dashboard (9119) plugin_api.py
  ├── 走 OV Console (8020): system/status, fs/*, content/*, search/find, admin/*
  │     函数: _proxy(method, path, params, json_body)
  │     认证: X-API-Key + X-OpenViking-Account + X-OpenViking-User
  │
  └── 走 OV Server (1933): search/grep, search/glob, sessions GET,
         relations/*, feedback, observer/*, export, import
        函数: _proxy_server(method, path, params, json_body)
        认证: X-API-Key (root_key)
```

### 1.3 错误处理铁律
```python
try:
    data = await _proxy(...)
    return data
except HTTPException:
    raise  # 透传
except httpx.ConnectError:
    raise HTTPException(502, detail="OV 不可达")
except httpx.TimeoutException:
    raise HTTPException(504, detail="OV 超时")
except Exception as e:
    logger.error("unexpected: %s", e)
    raise HTTPException(500, detail=str(e))
```
- 永不返回裸 Exception
- 所有代理调用必须走 _proxy 或 _proxy_server，禁止手写 httpx 调用
- 每个新路由必须做 curl 验证（见验证规范）

### 1.4 禁止事项
- ❌ 在路由函数中直接用 httpx.AsyncClient
- ❌ 硬编码 URI（除常量 OV_CONSOLE_URL / OV_SERVER_URL）
- ❌ 路由函数超过 20 行
- ❌ 不验证参数直接透传（uri 空必须 400）

---

## 二、前端组件规范

### 2.1 SDK 依赖（铁律）
```javascript
const SDK = window.__HERMES_PLUGIN_SDK__;
const { React } = SDK;               // 大写R
const { useState, useEffect, useCallback, useMemo, useRef, useReducer } = SDK.hooks;
const { Card, CardHeader, CardTitle, CardContent, Badge, Button, Input, Tabs, TabsList, TabsTrigger } = SDK.components;
const { cn, timeAgo } = SDK.utils;
```
- ❌ 禁止 import/require
- ❌ 禁止 JSX（用 React.createElement）
- ✅ 注册: `window.__HERMES_PLUGINS__.register("ov-console", App);`

### 2.2 组件模式
```javascript
// 简单状态 → useState
// 复杂状态（3+ 可变字段）→ useReducer
// 不变函数 → useCallback
// 计算值 → useMemo

// Tab 结构：
function App() {
  return React.createElement(Tabs, {defaultValue: "dashboard"}, function(active, setActive) {
    return React.createElement(React.Fragment, null,
      React.createElement(TabsList, null,
        React.createElement(TabsTrigger, {value: "dashboard", active: active==="dashboard",
          onClick: function() { setActive("dashboard"); }}, "仪表盘"),
        // ... more tabs
      ),
      active === "dashboard" && React.createElement(DashboardTab, null),
      // ... more tab contents
    );
  });
}
```

### 2.3 数据获取
```javascript
// 首选：SDK.fetchJSON (自动带 session token)
SDK.fetchJSON('/api/plugins/ov-console/system/status')
  .then(setData)
  .catch(setError);

// 次选：fetch (需要手动处理)
```

### 2.4 组件拆分原则
- 每个 Tab 独立组件函数
- 可复用子组件抽取为独立函数
- 单文件不超过 800 行（超出拆文件不可行时，用注释分段）
- 每个组件函数加 `/* ComponentName: 一句话 */` 注释

### 2.5 样式约束
- 优先用 cn() 工具函数
- 禁止内联 style（除动态值）
- 颜色: 统一用 Tailwind 语义类（text-red-400 而非 #ff0000）
- 间距: 用 gap-2 gap-4 gap-6 三级

---

## 三、验证规范

### 3.1 修改后必须执行的验证
```bash
# 1. 语法检查
python3 -m py_compile plugin_api.py
node --check dist/index.js

# 2. Dashboard 插件重扫描
curl -s http://127.0.0.1:9119/api/dashboard/plugins/rescan

# 3. 全量 API 端点测试
bash verify.sh

# 4. 性能基线对比
bash verify.sh --perf
```

### 3.2 验证内容
- 所有 API 端点返回 200
- 响应体是有效 JSON
- 关键字段存在（status, result）
- 新增端点响应时间不超过基线 3×
- Dashboard 插件列表包含 ov-console

### 3.3 验证失败处理
- 任一步失败 → 停止，修复，重跑
- 不跳过任何验证步骤
- 验证结果写入 `~/.hermes/workspace/ov-console-verify-YYYYMMDD-HHMMSS.log`

---

## 四、版本规范

### 4.1 语义化版本
- 主版本号：架构级重写（如 v1→v2 全量替换前端）
- 次版本号：新增 tab 或 API 路由
- 修订号：bug 修复、文案调整

### 4.2 版本同步
- manifest.json 的 version 字段必须与代码状态一致
- 每次修改前记录当前版本号
- 修改后判定版本号变更级别并同步更新

---

## 五、自主工作约束

### 5.1 子代理可执行的任务
- 调研/api验证/代码审查（需提供具体文件路径和验证命令）
- 单个 API 路由的新增（需提供完整函数签名和测试 curl）
- 前端单个组件的修改（需提供组件函数签名和 SDK 调用方式）

### 5.2 子代理不可执行的任务
- 架构决策（tab 增删、信息架构调整）
- 全量前端重写（需曜自己统筹）
- 性能优化（需曜评估基线）

### 5.3 曜的提交标准
- 每次提交包含：代码变更 + 验证通过日志 + 版本号更新
- 不累积超过 2 个路由的未验证变更
- 前端变更必须浏览器目视确认（截图）
# OV 资源库 · 项目规则

> dashboard/ 目录专属编码规范。
> 违反任何一条 → 先修规则再写代码。

## 一、命名规范

### API 路由
```
动词在前，资源在后：
  /search/grep  ✅  不是 /grep
  /search/glob  ✅  不是 /glob/search
  /fs/tree      ✅  不是 /tree

查询参数用 Query，请求体用 Request body：
  GET  /content/read?uri=xxx&mode=full   ✅
  POST /content/write  body={uri, content, mode}  ✅

返回值统一包装：
  {"status":"ok","result":{...},"error":null}  或抛 HTTPException
```

### 前端函数
```
组件函数：PascalCase → DashboardTab, BrowseTree, SearchResultCard
工具函数：camelCase  → fetchSessions, formatBytes, parseUri
事件处理：handle+名词  → handleSearch, handleFeedbackClick
状态变量：描述性名词   → activeTab, selectedNode, searchResults

禁止：单字母变量(a,b,x)、拼音、中文变量名
```

### 文件
```
dist/index.js           # 唯一前端入口（SDK 限制）
plugin_api.py           # 唯一后端入口（manifest 配置）
manifest.json           # 不可改名
```

## 二、API 设计规范

### 代理层次
```
Dashboard (9119) → plugin_api.py
  ├── _proxy()        → OV Console (8020)   用于标准 CRUD
  └── _proxy_server() → OV Server (1933)    用于 Console 不代理的端点
```

### 认证
```
Console 8020 代理：X-API-Key + X-OpenViking-Account + X-OpenViking-User
Server 1933 直连：X-API-Key（root_key）+ Content-Type
```

### 错误处理
```python
# 必须捕获的异常类型
try:
    return await _proxy(...)
except httpx.ConnectError:
    raise HTTPException(502, "OV Console 不可达")
except httpx.TimeoutException:
    raise HTTPException(504, "请求超时")
except HTTPException:
    raise  # 透传
except Exception as e:
    raise HTTPException(502, str(e))
```

### 禁止事项
```
❌ 路由前缀写死完整路径 → 用 router = APIRouter(prefix="")
❌ 返回裸 dict 不包装 status → 统一 {"status":"ok","result":...}
❌ 静默吞异常 → 必须 log + raise HTTPException
❌ query param 和 body 混用 → GET 只用 query, POST 只用 body
```

## 三、前端组件规范

### SDK 用法（硬约束）
```javascript
// 必须这样获取 SDK
const SDK = window.__HERMES_PLUGIN_SDK__;
const { React } = SDK;              // 注意大写 R
const { Card, CardHeader, CardContent, Badge, Button, Tabs, TabsList, TabsTrigger }
  = SDK.components;
const { useState, useEffect, useCallback, useMemo, useRef }
  = SDK.hooks;
const { cn, timeAgo } = SDK.utils;

// 禁止
❌ import / require
❌ JSX（必须用 React.createElement）
❌ SDK.react（小写 r 不存在）
❌ SDK.ui（不存在，用 SDK.components）
```

### Tab 切换模式
```javascript
// Tabs render props 模式（不可用 TabsContent）
React.createElement(Tabs, {defaultValue: "dashboard"},
  function(active, setActive) {
    return React.createElement(React.Fragment, null,
      // Tab 按钮组
      React.createElement(TabsList, null,
        tabs.map(t => React.createElement(TabsTrigger, {
          key: t.id, value: t.id,
          active: active === t.id,
          onClick: () => setActive(t.id)
        }, t.label))
      ),
      // Tab 内容（条件渲染）
      active === "dashboard" && React.createElement(DashboardTab),
      active === "browse" && React.createElement(BrowseTab),
      // ...
    );
  }
);
```

### 状态管理
```
简单状态（<3 个值）：useState
复杂状态（>3 个值或互相依赖）：useReducer
跨 Tab 共享：提升到顶层 App 组件
持久化需求：SDK.fetchJSON 请求后端 API，不存 localStorage
```

### 数据加载
```javascript
// 标准模式：loading → error → empty → data
function useOVData(fetchFn, deps) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchFn()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, deps);

  return { data, loading, error };
}
```

### 错误展示
```
网络错误 → "连接失败，检查 OV 是否在运行"
API 错误 → 显示后端返回的具体错误信息
空数据   → "暂无数据"（不是空白页面）
```

## 四、禁止清单（本项目特有）

```
❌ 组件内部直接调 fetchJSON → 抽成自定义 hook
❌ 硬编码 URI 字符串 → 定义常量 VIKING_PREFIX
❌ 超过 30 个节点用 SVG 渲染 → 降级为列表
❌ timeAgo 传入无时区的日期字符串 → 加 "Z" 后缀
❌ Button 做假 Tab → 必须用 TabsTrigger render props
❌ 修改 dist/index.js 不先 node --check
❌ 修改 plugin_api.py 不先 python3 -m py_compile
❌ 重启 Dashboard 不先 curl /api/dashboard/plugins/rescan
```

## 五、验收标准

每完成一个 Phase，必须通过：

```
□ L1: python3 -m py_compile plugin_api.py  → exit 0
□ L1: node --check dist/index.js            → exit 0
□ L2: 所有 API 端点 curl 验证返回 200 + 非空 JSON
□ L2: 前端 SDK 注册成功（curl /api/dashboard/plugins 确认 ov-console 在列表中）
□ L3: 主人打开 Dashboard → 看到对应 tab → 数据正确展示
```

## 六、文件结构

```
plugins/ov-console/dashboard/
├── manifest.json          # 插件注册信息
├── plugin_api.py          # FastAPI 路由（后端）
├── dist/
│   └── index.js           # React 前端（编译后）
├── PROJECT_RULES.md       # 本文件
├── ACCEPTANCE.md          # 验收清单
└── test_api.sh            # API 端到端测试脚本
```

## 七、踩坑记录（本项目）

| 问题 | 原因 | 解决 |
|------|------|------|
| grep/glob 返回 200 空体 | route 不存在，被 SPA fallback 吞了 | 显式注册路由 + Server 直连 |
| 前端的 timeAgo 显示 NaN | OV 返回的 ISO 日期缺少 Z 后缀 | 前端加 `.replace(/$/, 'Z')` |
| 插件修改后 tab 不出现 | 浏览器缓存旧 JS | 先 rescan 再强制刷新 |
| _proxy 用了 Console 代理但 API 不在 openapi.json | Console 不转发未声明的端点 | 用 _proxy_server 直连 1933 |
