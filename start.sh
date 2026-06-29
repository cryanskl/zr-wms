#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${WEB_PORT:-5173}"
APP_URL="${APP_URL:-http://127.0.0.1:${WEB_PORT}}"
RUN_ID="$(date +"%Y%m%d-%H%M%S")"
LOG_DIR="$ROOT_DIR/logs/$RUN_ID"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
START_LOG="$LOG_DIR/start.log"

API_PID=""
WEB_PID=""
SERVICE_PID=""

log() {
  local message="$1"
  printf '[%s] %s\n' "$(date +"%Y-%m-%d %H:%M:%S")" "$message" | tee -a "$START_LOG"
}

cleanup() {
  local exit_code=$?

  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$WEB_PID" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup INT TERM EXIT

ensure_dependencies() {
  if ! command -v node >/dev/null 2>&1; then
    echo "未找到 node，请先安装 Node.js。" >&2
    exit 1
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    if command -v corepack >/dev/null 2>&1; then
      corepack enable
    fi
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    echo "未找到 pnpm，请先安装 pnpm 或启用 corepack。" >&2
    exit 1
  fi

  if [[ ! -d "$ROOT_DIR/node_modules" || ! -d "$ROOT_DIR/apps/api/node_modules" || ! -d "$ROOT_DIR/apps/web/node_modules" ]]; then
    log "依赖未完整下载，开始执行 pnpm install --frozen-lockfile"
    pnpm install --frozen-lockfile 2>&1 | tee -a "$START_LOG"
  else
    log "依赖已存在，跳过安装"
  fi
}

load_environment() {
  if [[ -f "$ROOT_DIR/.env" ]]; then
    log "加载根目录 .env"
    set -a
    # shellcheck disable=SC1091
    source "$ROOT_DIR/.env"
    set +a
  fi

  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "未找到 DATABASE_URL。请复制 .env.example 为 .env，并填入数据库连接。" >&2
    exit 1
  fi
}

restart_port() {
  local port="$1"
  local pids

  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -z "$pids" ]]; then
    log "端口 $port 空闲"
    return
  fi

  log "端口 $port 被占用，停止进程: $(echo "$pids" | tr '\n' ' ')"
  kill $pids >/dev/null 2>&1 || true
  sleep 1

  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "$pids" ]]; then
    log "端口 $port 仍被占用，强制停止进程: $(echo "$pids" | tr '\n' ' ')"
    kill -9 $pids >/dev/null 2>&1 || true
    sleep 1
  fi

  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "端口 $port 无法释放，请手动检查。" >&2
    exit 1
  fi

  log "端口 $port 已释放"
}

start_service() {
  local name="$1"
  local log_file="$2"
  shift 2

  log "启动 $name，日志写入 $log_file"
  "$@" >"$log_file" 2>&1 &
  local pid=$!
  log "$name PID: $pid"
  SERVICE_PID="$pid"
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local log_file="$3"
  local max_attempts=60

  for attempt in $(seq 1 "$max_attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name 已就绪: $url"
      return
    fi

    if (( attempt % 10 == 0 )); then
      log "等待 $name 就绪中($attempt/$max_attempts)，可查看 $log_file"
    fi

    sleep 1
  done

  echo "$name 启动超时，请查看 $log_file" >&2
  exit 1
}

mkdir -p "$LOG_DIR"
ln -sfn "$LOG_DIR" "$ROOT_DIR/logs/latest"
touch "$START_LOG" "$API_LOG" "$WEB_LOG"

log "本次运行日志目录: $LOG_DIR"
ensure_dependencies
load_environment
restart_port "$API_PORT"
restart_port "$WEB_PORT"

start_service "后端 API" "$API_LOG" env PORT="$API_PORT" pnpm --filter @zr-wms/api dev
API_PID="$SERVICE_PID"
start_service "前端 Web" "$WEB_LOG" env WEB_PORT="$WEB_PORT" pnpm --filter @zr-wms/web dev
WEB_PID="$SERVICE_PID"

wait_for_url "后端 API" "http://127.0.0.1:${API_PORT}/api/v1/health" "$API_LOG"
wait_for_url "前端 Web" "$APP_URL" "$WEB_LOG"

log "打开浏览器: $APP_URL"
open "$APP_URL"

log "启动完成。按 Ctrl+C 停止前后端。"
log "后端日志: $API_LOG"
log "前端日志: $WEB_LOG"

wait
