#!/bin/bash
# OV 资源库 Dashboard 插件 · 健康闭环
# 定时巡检 → 自动诊断 → 自动修复 → 再验证 → 报告
# 
# 用法:
#   bash health-check.sh            # 单次巡检
#   bash health-check.sh --cron     # cron 模式(静默，仅异常时输出)
#
# Cron: 0 * * * * bash ~/.hermes/hermes-agent/plugins/ov-console/dashboard/health-check.sh --cron

set -euo pipefail

PLUGIN_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$HOME/.hermes/workspace"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
HEALTH_LOG="$LOG_DIR/ov-health-${TIMESTAMP}.log"
STATE_FILE="$LOG_DIR/ov-health-state.txt"
MAX_RETRIES=3
CRON_MODE=false

for arg in "$@"; do
  case "$arg" in
    --cron) CRON_MODE=true ;;
  esac
done

log() { 
  echo "[$(date +%H:%M:%S)] $@" | tee -a "$HEALTH_LOG"
  if [ "$CRON_MODE" = true ]; then
    echo "[$(date +%H:%M:%S)] $@" >> "$LOG_DIR/ov-health-cron.log"
  fi
}

# ── Phase 1: 语法 + API 验证 ────────────────────────────
log "============================================"
log "OV 健康闭环 · 巡检开始 — $TIMESTAMP"
log "============================================"

log ""
log ">>> Phase 1: 验证 (verify.sh)"

VERIFY_OUT="$LOG_DIR/ov-verify-${TIMESTAMP}.log"
if bash "$PLUGIN_DIR/verify.sh" > "$VERIFY_OUT" 2>&1; then
  VERIFY_PASS=true
  log "   ✅ 全部验证通过"
else
  VERIFY_PASS=false
  FAIL_COUNT=$(grep -c '❌ FAIL' "$VERIFY_OUT" 2>/dev/null || echo "?")
  log "   ❌ 验证失败 ($FAIL_COUNT 项)"
  
  # 提取失败项
  grep '❌ FAIL' "$VERIFY_OUT" 2>/dev/null | while read line; do
    log "      $line"
  done
fi

# ── Phase 2: 自动修复 ────────────────────────────────────
if [ "$VERIFY_PASS" = false ]; then
  log ""
  log ">>> Phase 2: 自动修复 (auto-heal.sh)"
  
  HEAL_OUT="$LOG_DIR/ov-heal-${TIMESTAMP}.log"
  bash "$PLUGIN_DIR/auto-heal.sh" > "$HEAL_OUT" 2>&1 || true
  
  HEALED=$(grep -c '✅.*修复\|✅.*重启成功\|✅.*已重建' "$HEAL_OUT" 2>/dev/null || echo "0")
  HEAL_FAILED=$(grep -c '❌.*修复失败\|❌.*重启失败\|需手动' "$HEAL_OUT" 2>/dev/null || echo "0")
  log "   修复: $HEALED 成功, $HEAL_FAILED 失败"
fi

# ── Phase 3: 再验证 ──────────────────────────────────────
log ""
log ">>> Phase 3: 再验证"

if bash "$PLUGIN_DIR/verify.sh" > "$LOG_DIR/ov-reverify-${TIMESTAMP}.log" 2>&1; then
  REVERIFY_PASS=true
  log "   ✅ 修复后再验证通过"
else
  REVERIFY_PASS=false
  log "   ❌ 修复后仍失败"
  grep '❌ FAIL' "$LOG_DIR/ov-reverify-${TIMESTAMP}.log" 2>/dev/null | while read line; do
    log "      $line"
  done
fi

# ── Phase 4: 基线管理 ────────────────────────────────────
log ""
log ">>> Phase 4: 基线管理"

BASELINE_FILE="$LOG_DIR/ov-console-perf-baseline.txt"

# 采集当前性能数据
declare -A PERF_URLS=(
  ["system-status"]="http://127.0.0.1:9119/api/plugins/ov-console/system/status"
  ["fs-tree"]="http://127.0.0.1:9119/api/plugins/ov-console/fs/tree"
  ["fs-stat"]="http://127.0.0.1:9119/api/plugins/ov-console/fs/stat?uri=viking://agent"
  ["content-read"]="http://127.0.0.1:9119/api/plugins/ov-console/content/read?uri=viking://agent&mode=abstract"
)

PERF_DRIFT=0
for name in "${!PERF_URLS[@]}"; do
  url="${PERF_URLS[$name]}"
  t=$(curl -s -o /dev/null -w '%{time_total}' --max-time 5 "$url" 2>/dev/null || echo "0")
  
  if [ -f "$BASELINE_FILE" ]; then
    prev=$(grep "^$name:" "$BASELINE_FILE" 2>/dev/null | awk '{print $2}' || echo "0")
    if [ "$prev" != "0" ] && [ "$t" != "0" ]; then
      ratio=$(echo "scale=2; $t / $prev" | bc 2>/dev/null || echo "1")
      ratio_check=$(echo "$ratio > 3.0" | bc -l 2>/dev/null || echo "0")
      if [ "$ratio_check" = "1" ]; then
        log "   ⚠️  $name: ${t}s vs 基线 ${prev}s (${ratio}× 超过阈值!)"
        PERF_DRIFT=$((PERF_DRIFT+1))
      fi
    fi
  fi
  
  # 更新基线（滑动平均，新样本权重 0.3）
  if [ -f "$BASELINE_FILE" ] && [ "$prev" != "0" ] && [ "$t" != "0" ]; then
    new_baseline=$(echo "scale=6; $prev * 0.7 + $t * 0.3" | bc)
    sed -i "s/^$name: .*/$name: $new_baseline/" "$BASELINE_FILE"
  elif [ "$t" != "0" ]; then
    echo "$name: $t" >> "$BASELINE_FILE"
  fi
done

if [ "$PERF_DRIFT" -eq 0 ]; then
  log "   ✅ 性能基线正常，无漂移"
else
  log "   ⚠️  $PERF_DRIFT 项性能漂移超过阈值"
fi

# ── Phase 5: 状态持久化 + 报告 ──────────────────────────
log ""
log ">>> Phase 5: 状态报告"

# 更新状态文件
cat > "$STATE_FILE" << STATE
timestamp: $TIMESTAMP
verify_pass: $VERIFY_PASS
reverify_pass: ${REVERIFY_PASS:-N/A}
healed: ${HEALED:-0}
heal_failed: ${HEAL_FAILED:-0}
perf_drift: $PERF_DRIFT
STATE
log "   状态已保存到 $STATE_FILE"

# 最终判定
if [ "$VERIFY_PASS" = true ] || [ "${REVERIFY_PASS:-false}" = true ]; then
  log ""
  log "============================================"
  log "🟢 系统健康 — 全部通过"
  log "日志: $HEALTH_LOG"
  log "============================================"
  exit 0
else
  log ""
  log "============================================"
  log "🔴 系统异常 — 需人工介入"
  log "  验证: $(grep '❌ FAIL' "$VERIFY_OUT" 2>/dev/null | head -3 || echo 'N/A')"
  log "  修复: ${HEALED:-0} 成功, ${HEAL_FAILED:-0} 失败"
  log "  日志: $HEALTH_LOG"
  log "============================================"
  exit 1
fi
