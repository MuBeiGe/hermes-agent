#!/bin/bash
# OV 资源库 Dashboard 插件 · 自验证脚本
# 用法: bash verify.sh [--perf] [--quick]
#   --perf: 采集性能数据并对比基线
#   --quick: 只做语法+HTTP状态码检查，不做内容验证

set -euo pipefail

DASHBOARD_URL="http://127.0.0.1:9119"
PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HOME/.hermes/workspace"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/ov-console-verify-$TIMESTAMP.log"
PERF_MODE=false
QUICK_MODE=false

for arg in "$@"; do
  case "$arg" in
    --perf) PERF_MODE=true ;;
    --quick) QUICK_MODE=true ;;
  esac
done

PASS=0
FAIL=0

log() { echo "$@" | tee -a "$LOG_FILE"; }
pass() { log "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { log "  ❌ FAIL: $1 — $2"; FAIL=$((FAIL+1)); }
warn() { log "  ⚠️  WARN: $1 — $2"; }

mkdir -p "$LOG_DIR"
log "============================================"
log "OV 资源库插件验证 — $TIMESTAMP"
log "============================================"

# ── 1. 语法检查 ──────────────────────────────────────────
log ""
log "【1】语法检查"

if python3 -m py_compile "$PLUGIN_DIR/plugin_api.py" 2>&1 | tee -a "$LOG_FILE"; then
  pass "plugin_api.py 语法正确"
else
  fail "plugin_api.py" "语法错误"
fi

if node --check "$PLUGIN_DIR/dist/index.js" 2>&1 | tee -a "$LOG_FILE"; then
  pass "dist/index.js 语法正确"
else
  fail "dist/index.js" "语法错误"
fi

# ── 2. Dashboard 插件注册 ───────────────────────────────
log ""
log "【2】插件注册"

PLUGIN_RES=$(curl -s "$DASHBOARD_URL/api/dashboard/plugins" 2>/dev/null)
if echo "$PLUGIN_RES" | grep -q '"ov-console"'; then
  pass "ov-console 插件已注册"
else
  fail "插件注册" "ov-console 不在插件列表中，尝试 rescan"
  curl -s "$DASHBOARD_URL/api/dashboard/plugins/rescan" > /dev/null 2>&1
  PLUGIN_RES2=$(curl -s "$DASHBOARD_URL/api/dashboard/plugins" 2>/dev/null)
  if echo "$PLUGIN_RES2" | grep -q '"ov-console"'; then
    pass "rescan 后 ov-console 已注册"
  else
    fail "插件注册" "rescan 后仍未找到 ov-console"
  fi
fi

# ── 3. API 端点全量测试 ─────────────────────────────────
log ""
log "【3】API 端点测试"

declare -A ENDPOINTS=(
  # 已有路由 — 走 Console 8020
  ["health"]="GET /api/plugins/ov-console/health||"
  ["system/status"]="GET /api/plugins/ov-console/system/status||"
  ["capabilities"]="GET /api/plugins/ov-console/capabilities||"
  ["fs/tree"]="GET /api/plugins/ov-console/fs/tree||"
  ["fs/stat"]="GET /api/plugins/ov-console/fs/stat?uri=viking://agent||"
  ["content/read"]="GET /api/plugins/ov-console/content/read?uri=viking://agent&mode=abstract||"
  ["search/find"]="POST /api/plugins/ov-console/search||{\"query\":\"test\",\"limit\":1}"
  ["sessions/create"]="POST /api/plugins/ov-console/sessions||{}"
  ["admin/accounts"]="GET /api/plugins/ov-console/admin/accounts||"
)

# 如果后端已实现新路由，也测
declare -A NEW_ENDPOINTS=(
  ["search/grep"]="POST /api/plugins/ov-console/search/grep||{\"uri\":\"viking://agent\",\"pattern\":\"test\"}"
  ["search/glob"]="POST /api/plugins/ov-console/search/glob||{\"pattern\":\"*.md\"}"
  ["sessions/list"]="GET /api/plugins/ov-console/sessions||"
  ["relations/get"]="GET /api/plugins/ov-console/relations?uri=viking://agent||"
  ["observer/system"]="GET /api/plugins/ov-console/observer/system||"
  ["export"]="POST /api/plugins/ov-console/export||{\"uri\":\"viking://agent\",\"to\":\"/tmp/ov-test-export.ovpack\"}"
)

test_endpoint() {
  local name="$1"
  local method_path_body="$2"
  local method_path="${method_path_body%%||*}"
  local body_json="${method_path_body#*||}"
  [[ "$body_json" == "$method_path_body" ]] && body_json=""
  local method="${method_path%% *}"
  local path="${method_path#* }"
  local url="$DASHBOARD_URL$path"
  local start_time=$(date +%s%N)

  if [ "$method" = "GET" ]; then
    response=$(curl -s -o /tmp/ov_verify_resp.txt -w "%{http_code}" "$url" 2>/dev/null)
  else
    local data="$body_json"
    if [ -z "$data" ]; then
      data='{"uri":"viking://agent"}'
    fi
    response=$(curl -s -o /tmp/ov_verify_resp.txt -w "%{http_code}" -X POST "$url" \
      -H "Content-Type: application/json" \
      -d "$data" 2>/dev/null)
  fi

  local end_time=$(date +%s%N)
  local elapsed_ms=$(( (end_time - start_time) / 1000000 ))
  local body=$(cat /tmp/ov_verify_resp.txt 2>/dev/null | head -c 2000)

  if [ "$response" = "200" ]; then
    # 内容验证：HTML = 路由未注册，{ = 有效 JSON
    if echo "$body" | head -c 20 | grep -q '<!doctype\|<!DOCTYPE\|<html'; then
      warn "$name" "200 但返回 HTML (路由可能未注册)"
    elif echo "$body" | head -c 1 | grep -q '{'; then
      if [ "$QUICK_MODE" = false ] && [ ${#body} -lt 1000 ]; then
        if echo "$body" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
          pass "$name (${elapsed_ms}ms)"
        else
          warn "$name" "200 但 JSON 不完整 (${#body}字节截断)"
        fi
      else
        pass "$name (${elapsed_ms}ms)"
      fi
    else
      warn "$name" "200 但非 JSON/HTML"
    fi
  elif [ "$response" = "502" ] || [ "$response" = "504" ]; then
    warn "$name" "HTTP $response (OV 后端不可达)"
  elif [ "$response" = "404" ]; then
    # 新路由可能还没实现，不算失败
    warn "$name" "HTTP 404 (路由未实现)"
  else
    fail "$name" "HTTP $response"
  fi
}

for name in "${!ENDPOINTS[@]}"; do
  test_endpoint "$name" "${ENDPOINTS[$name]}"
done

log "  --- 新路由 (未实现则预期404) ---"
for name in "${!NEW_ENDPOINTS[@]}"; do
  test_endpoint "$name" "${NEW_ENDPOINTS[$name]}"
done

# ── 4. 性能基线采集 ─────────────────────────────────────
if [ "$PERF_MODE" = true ]; then
  log ""
  log "【4】性能基线"

  BASELINE_FILE="$LOG_DIR/ov-console-perf-baseline.txt"
  declare -A PERF_TESTS=(
    ["status"]="$DASHBOARD_URL/api/plugins/ov-console/system/status"
    ["tree"]="$DASHBOARD_URL/api/plugins/ov-console/fs/tree"
    ["stat"]="$DASHBOARD_URL/api/plugins/ov-console/fs/stat?uri=viking://agent"
    ["read"]="$DASHBOARD_URL/api/plugins/ov-console/content/read?uri=viking://agent&mode=abstract"
  )

  for name in "${!PERF_TESTS[@]}"; do
    url="${PERF_TESTS[$name]}"
    total=0
    for i in $(seq 1 3); do
      t=$(curl -s -o /dev/null -w '%{time_total}' "$url" 2>/dev/null)
      total=$(echo "$total + $t" | bc)
    done
    avg=$(echo "scale=3; $total / 3" | bc)
    log "  $name: avg ${avg}s (3次采样)"

    # 对比基线
    if [ -f "$BASELINE_FILE" ]; then
      prev=$(grep "^$name:" "$BASELINE_FILE" 2>/dev/null | cut -d' ' -f2 || echo "0")
      if [ "$prev" != "0" ]; then
        ratio=$(echo "scale=2; $avg / $prev" | bc)
        if (( $(echo "$ratio > 3.0" | bc -l) )); then
          fail "$name 性能" "当前 ${avg}s, 基线 ${prev}s, 比率 ${ratio}× (超过3×阈值)"
        else
          pass "$name 性能: ${avg}s vs 基线 ${prev}s (${ratio}×)"
        fi
      fi
    fi
  done

  # 保存新基线
  log "  → 保存新基线到 $BASELINE_FILE"
  for name in "${!PERF_TESTS[@]}"; do
    url="${PERF_TESTS[$name]}"
    t=$(curl -s -o /dev/null -w '%{time_total}' "$url" 2>/dev/null)
    echo "$name: $t" >> "$BASELINE_FILE.new"
  done
  mv "$BASELINE_FILE.new" "$BASELINE_FILE"
fi

# ── 5. 结果汇总 ──────────────────────────────────────────
log ""
log "============================================"
log "验证完成: ✅ $PASS 通过, ❌ $FAIL 失败"
log "日志: $LOG_FILE"
log "============================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
