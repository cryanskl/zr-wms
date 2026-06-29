# start.sh 中文标点前变量未加花括号导致启动中断

- 日期：2026-06-29
- 状态：已修复
- 修复提交：`d7c23ec Fix startup script shell variable boundary`
- 影响范围：本地启动脚本 `start.sh`

## 现象

执行 `./start.sh` 时，脚本在启动后端服务前后中断。带 `bash -x ./start.sh` 调试时看到类似错误：

```text
./start.sh: line 115: name�: unbound variable
```

由于脚本设置了 `set -euo pipefail`，变量解析失败会直接退出，导致前后端没有真正启动，`api.log` / `web.log` 也可能为空。

## 触发条件

`start_service()` 中有如下日志语句：

```bash
log "启动 $name，日志写入 $log_file"
```

在当前 shell/locale 组合下，`$name` 后紧跟中文逗号 `，`，bash 在展开变量时把边界解析异常，触发 `set -u` 的未绑定变量错误。

## 根因

Shell 变量后面紧跟非 ASCII 标点时，裸写 `$name` 的边界不够明确。脚本里开启了 `set -u`，任何被误解析出来的“未定义变量名”都会让脚本退出。

## 修复

把中文标点前的变量改成显式花括号形式：

```bash
log "启动 ${name}，日志写入 ${log_file}"
```

同时新增回归测试：

```text
scripts/start-sh.test.mjs
```

测试要求：中文日志文本前的 shell 变量必须使用 `${...}` 明确边界。

## 验证

修复后已验证：

```bash
node --test scripts/start-sh.test.mjs
bash -n start.sh
pnpm test
pnpm typecheck
pnpm build
```

运行验证：

```bash
./start.sh
curl -fsS http://127.0.0.1:3000/api/v1/health
curl -fsS -I http://127.0.0.1:5173
```

观察结果：

- API health 返回 `{"ok":true,"service":"zr-wms-api"}`
- 前端 `http://127.0.0.1:5173` 返回 `200 OK`

## 预防

- Shell 脚本中变量后面只要紧跟中文、标点或其他非变量名字符，优先写成 `${var}`。
- 修改 `start.sh` 后至少跑：

```bash
node --test scripts/start-sh.test.mjs
bash -n start.sh
```

- 若启动脚本异常退出，优先用：

```bash
bash -x ./start.sh
```

定位具体退出行，再补回归测试。
