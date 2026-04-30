#!/bin/bash
# OV 资源库 Dashboard 插件 · 自动修复脚本
# 读取 rules.yaml，对可修复的故障执行修复策略并验证
# 用法: bash auto-heal.sh [--dry-run]

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES_FILE="$PLUGIN_DIR/rules.yaml"
LOG_DIR="$HOME/.hermes/workspace"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/ov-auto-heal-$TIMESTAMP.log"
DRY_RUN=false
HEALED=0
FAILED=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

log() { echo "[$(date +%H:%M:%S)] $@" | tee -a "$LOG_FILE"; }

# ── 辅助函数 ──────────────────────────────────────────────

check_url() {
  local url="$1" expect_status="$2"
  local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  [ "$status" = "$expect_status" ]
}

check_url_content() {
  local url="$1" pattern="$2"
  local body=$(curl -s --max-time 5 "$url" 2>/dev/null)
  echo "$body" | grep -q "$pattern"
}

# ── 修复策略 ──────────────────────────────────────────────

heal_restart_dashboard() {
  log "🔧 尝试修复: 重启 Dashboard"
  if [ "$DRY_RUN" = true ]; then
    log "   [DRY-RUN] 将执行: pkill + 重启 hermes dashboard"
    return 0
  fi
  
  pkill -f "hermes dashboard" 2>/dev/null || true
  sleep 2
  cd ~/.hermes/hermes-agent
  nohup venv/bin/hermes dashboard --tui --no-open --port 9119 --host 127.0.0.1 \
    > ~/.hermes/logs/dashboard.log 2>&1 &
  sleep 4
  
  if check_url "http://127.0.0.1:9119/api/dashboard/plugins" "200"; then
    log "   ✅ Dashboard 重启成功"
    HEALED=$((HEALED+1))
    return 0
  else
    log "   ❌ Dashboard 重启失败"
    FAILED=$((FAILED+1))
    return 1
  fi
}

heal_restart_ov_server() {
  log "🔧 尝试修复: 重启 OV Server"
  if [ "$DRY_RUN" = true ]; then
    log "   [DRY-RUN] 将执行: pkill + 重启 OV Server"
    return 0
  fi
  
  pkill -f "openviking.*server" 2>/dev/null || true
  sleep 2
  cd /home/byyg/openviking_env
  nohup bin/openviking server --host 127.0.0.1 --port 1933 \
    > ~/.hermes/logs/ov-server.log 2>&1 &
  sleep 4
  
  if check_url "http://127.0.0.1:1933/health" "200"; then
    log "   ✅ OV Server 重启成功"
    HEALED=$((HEALED+1))
    return 0
  else
    log "   ❌ OV Server 重启失败"
    FAILED=$((FAILED+1))
    return 1
  fi
}

heal_recreate_manifest() {
  log "🔧 尝试修复: 重建 manifest.json"
  if [ "$DRY_RUN" = true ]; then
    log "   [DRY-RUN] 将重建 manifest.json"
    return 0
  fi
  
  cat > "$PLUGIN_DIR/manifest.json" << 'MANIFEST'
{
  "name": "ov-console",
  "label": "资源库",
  "description": "OpenViking 资源库 — Agent 技能/记忆、外部文档、会话归档的可视化管理",
  "icon": "Database",
  "version": "2.0.0",
  "tab": {
    "path": "/ov-console",
    "position": "after:skills"
  },
  "entry": "dist/index.js",
  "api": "plugin_api.py"
}
MANIFEST
  log "   ✅ manifest.json 已重建"
  HEALED=$((HEALED+1))
}

# ── 诊断 + 修复主流程 ────────────────────────────────────

log "============================================"
log "OV 资源库插件 · 自动修复 — $TIMESTAMP"
log "============================================"

# 1. 检查 Dashboard 是否响应
log ""
log "【诊断】Dashboard 服务"
if check_url "http://127.0.0.1:9119/api/dashboard/plugins" "200"; then
  if curl -s http://127.0.0.1:9119/api/dashboard/plugins | grep -q '"ov-console"'; then
    log "   ✅ Dashboard 正常，插件已注册"
  else
    log "   ⚠️  Dashboard 响应但 ov-console 插件未注册，尝试 rescan"
    curl -s http://127.0.0.1:9119/api/dashboard/plugins/rescan > /dev/null 2>&1
    sleep 1
    if curl -s http://127.0.0.1:9119/api/dashboard/plugins | grep -q '"ov-console"'; then
      log "   ✅ rescan 后插件已注册"
    else
      log "   ❌ 插件注册失败，尝试重启 Dashboard"
      heal_restart_dashboard
    fi
  fi
else
  log "   ❌ Dashboard 无响应，尝试重启"
  heal_restart_dashboard
fi

# 2. 检查 OV Server
log ""
log "【诊断】OV Server"
if check_url "http://127.0.0.1:1933/health" "200"; then
  log "   ✅ OV Server 正常"
else
  log "   ❌ OV Server 无响应，尝试重启"
  heal_restart_ov_server
fi

# 3. 检查 OV Server
log ""
log "【诊断】OV Server"
if check_url "http://127.0.0.1:1933/api/v1/system/status" "200"; then
  log "   ✅ OV Server 正常"
else
  log "   ❌ OV Server 无响应，尝试重启"
  heal_restart_ov_server
fi

# 4. 检查关键文件
log ""
log "【诊断】文件完整性"
if [ -f "$PLUGIN_DIR/manifest.json" ]; then
  log "   ✅ manifest.json 存在"
else
  log "   ❌ manifest.json 缺失，尝试重建"
  heal_recreate_manifest
fi

for f in plugin_api.py dist/index.js RULES.md rules.yaml; do
  if [ -f "$PLUGIN_DIR/$f" ]; then
    log "   ✅ $f 存在"
  else
    log "   ❌ $f 缺失（需手动修复）"
    FAILED=$((FAILED+1))
  fi
done

# 5. 语法检查（不自动修，但记录）
log ""
log "【诊断】语法正确性"
if python3 -m py_compile "$PLUGIN_DIR/plugin_api.py" 2>/dev/null; then
  log "   ✅ plugin_api.py 语法正确"
else
  log "   ❌ plugin_api.py 语法错误（需手动修复）"
  FAILED=$((FAILED+1))
fi

if node --check "$PLUGIN_DIR/dist/index.js" 2>/dev/null; then
  log "   ✅ dist/index.js 语法正确"
else
  log "   ❌ dist/index.js 语法错误（需手动修复）"
  FAILED=$((FAILED+1))
fi

# ── 结果 ──────────────────────────────────────────────────
log ""
log "============================================"
log "修复完成: ✅ 修复 $HEALED 项, ❌ 失败 $FAILED 项"
log "日志: $LOG_FILE"
log "============================================"

exit $FAILED
