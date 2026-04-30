# OV 资源库 Dashboard 插件 · 基线数据

> 基准日期: 2026-04-29 01:23 UTC
> 采集方式: verify.sh --perf (3次采样取平均)

## 性能基线

| 端点 | 平均响应 | 阈值 (3×) | 说明 |
|------|---------|-----------|------|
| system/status | 5ms | 15ms | OV 系统状态 |
| fs/tree | 68ms | 204ms | 完整目录树 (969项) |
| fs/stat | 5ms | 15ms | 单文件元数据 |
| content/read | 5ms | 15ms | abstract 模式读取 |
| search/find | ~10ms | 30ms | 语义搜索 (返回大JSON) |
| sessions/create | 12ms | 36ms | 创建会话 |

## 基线采集命令
```bash
bash ~/.hermes/hermes-agent/plugins/ov-console/dashboard/verify.sh --perf
```

## 质量基线

| 指标 | 当前值 | 目标 |
|------|--------|------|
| 语法检查通过率 | 2/2 (100%) | 100% |
| API 端点可用率 | 9/9 已实现 (100%) | 100% |
| 新路由实现率 | 0/6 (0%) | Phase 1 后 6/6 |
| 性能回归率 | 0/4 (0%) | 0% |

## 行为基线

- Dashboard 插件注册: ✅ ov-console 在列表中
- 所有已实现路由返回有效 JSON: ✅ (fs/tree + search/find 因响应体>500字节被截断警告，实际JSON完整)
- 未实现路由: search/grep → 405, search/glob → 405, export → 405, observer/system → HTML(SPA fallback), relations/get → HTML, sessions/list → HTML

## 变更记录

| 日期 | 变更 | 基线影响 |
|------|------|---------|
| 2026-04-29 | 初始基线建立 | — |
