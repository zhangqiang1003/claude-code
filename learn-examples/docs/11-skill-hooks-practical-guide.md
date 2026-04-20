# Skill Hooks 实战指南

> 本文档是 Skill Hooks 进阶学习的实战配套文档，基于 Claude Code 源码和真实场景设计。

## 目录

1. [场景 1：危险 Bash 命令拦截](#场景-1危险-bash-命令拦截)
2. [场景 2：commit 前代码检查](#场景-2commit-前代码检查)
3. [场景 3：非工作时间敏感操作确认](#场景-3非工作时间敏感操作确认)（待实现）

---

## 场景 1：危险 Bash 命令拦截

### 需求分析

拦截以下危险命令：
- `rm -rf` 涉及 `/` 或 `home` 目录
- `git push --force`
- `curl | sh`（远程脚本执行）
- `chmod 777`

### 设计方案

#### SKILL.md 实现

```yaml
name: security-hooks
description: 安全防护 Hooks - 拦截危险 Bash 命令

hooks:
  preToolUse:
    - matcher: "Bash"
      hooks:
        # =====================
        # 危险命令拦截
        # =====================
        - type: command
          # 只对包含这些关键词的 Bash 调用生效
          if: "rm | git push | curl | wget | chmod"
          command: |
            #!/bin/bash
            CMD="$ARGUMENTS"

            # ----------------------------
            # 模式 1: rm -rf 危险路径
            # ----------------------------
            if echo "$CMD" | grep -qE 'rm\s+-rf|rm\s+-r\s+-f'; then
              # 检查是否涉及敏感路径
              if echo "$CMD" | grep -qE '/$|/home|~/|\.\./|/root'; then
                echo '{"decision": "block", "reason": "rm -rf on sensitive path detected: $CMD"}'
                exit 2  # 阻止执行
              fi
            fi

            # ----------------------------
            # 模式 2: git push --force
            # ----------------------------
            if echo "$CMD" | grep -qE 'git\s+push.*--force|git\s+push.*-f\s'; then
              echo '{"decision": "warn", "reason": "git force push detected"}'
              exit 1  # 警告但继续
            fi

            # ----------------------------
            # 模式 3: curl | sh (RCE 风险)
            # ----------------------------
            if echo "$CMD" | grep -qE 'curl\s+.*\|\s*sh|wget\s+.*\|\s*sh'; then
              echo '{"decision": "block", "reason": "Pipe to shell detected (possible RCE)"}'
              exit 2  # 阻止执行
            fi

            # ----------------------------
            # 模式 4: chmod 777
            # ----------------------------
            if echo "$CMD" | grep -qE 'chmod\s+777'; then
              echo '{"decision": "warn", "reason": "chmod 777 detected - insecure permission"}'
              exit 1  # 警告但继续
            fi

            # 所有检查通过
            exit 0
```

### 关键设计点

#### 1. `if` 条件过滤

```yaml
if: "rm | git push | curl | wget | chmod"
```

**作用：** 只有当 Bash 命令包含这些关键词时才执行 hook。

**好处：**
- 减少不必要的 hook 执行开销
- 只对可能危险的操作进行检查

#### 2. 输出格式选择

| 场景 | 格式 | 示例 |
|------|------|------|
| 简单判断 | 纯文本 exit code | `exit 2` = 阻止 |
| 需要详细信息 | JSON | `{"decision": "block", "reason": "..."}` |

**本例选择 JSON 的原因：**
- 需要向用户显示具体的危险原因
- 便于后续扩展（如添加 `showUser`、`logToAudit` 等字段）

#### 3. exit code 含义

| exit code | 含义 | 行为 |
|-----------|------|------|
| `0` | 放行 | 工具正常执行 |
| `1` | 警告 | 显示警告信息，工具仍执行 |
| `2` | 阻止 | 工具不执行 |

#### 4. 并行执行特性

**重要：** Hook 是并行执行的，不是串链。

```
Hook A (localSettings) ──┐
Hook B (projectSettings)─┼──→ 并行执行
Hook C (userSettings)  ──┘
```

虽然并行，但 `exit code = 2` 会阻止工具执行。

### 进阶优化

#### 添加日志记录

```yaml
- type: command
  command: |
    # 记录到审计日志
    echo "[$(date)] $CMD" >> ~/.claude/hook-audit.log
    # ... 检查逻辑 ...
```

#### 添加白名单

```yaml
- type: command
  command: |
    CMD="$ARGUMENTS"

    # 白名单检查
    if [ "$CMD" = "rm -rf /tmp/*" ]; then
      echo "Whitelisted command"
      exit 0
    fi

    # ... 检查逻辑 ...
```

### 测试验证

```bash
# 测试 rm -rf /
echo "rm -rf /" | ./security-hooks-hook.sh
# 期望：exit code 2，阻止执行

# 测试 git push --force
echo "git push --force origin main" | ./security-hooks-hook.sh
# 期望：exit code 1，警告但继续
```

---

## 场景 2：commit 前代码检查

### 需求分析

- 当执行 `git commit` 时，自动运行 lint
- 如果 lint 失败，阻止 commit
- 如果有未格式化的代码，提醒格式化
- 支持多种包管理器（bun/npm/yarn/pnpm）
- 检测并阻止 `--no-verify` 绕过

### 设计方案

#### SKILL.md 实现

```yaml
name: code-quality-hooks
description: 代码质量检查 Hooks - commit 前自动 lint

hooks:
  preToolUse:
    - matcher: "Bash"
      hooks:
        # =====================
        # Commit 前代码检查
        # =====================
        - type: command
          if: "git commit"
          command: |
            #!/bin/bash
            CMD="$ARGUMENTS"

            # ----------------------------
            # 检测 --no-verify 绕过
            # ----------------------------
            if echo "$CMD" | grep -qE '\-\-no\-verify|-n'; then
              echo '{"decision": "block", "reason": "Use of --no-verify is not allowed. Fix lint errors instead."}'
              exit 2
            fi

            # ----------------------------
            # 检测包管理器
            # ----------------------------
            detect_package_manager() {
              if [ -f "bun.lockb" ]; then echo "bun"
              elif [ -f "pnpm-lock.yaml" ]; then echo "pnpm"
              elif [ -f "yarn.lock" ]; then echo "yarn"
              elif [ -f "package-lock.json" ]; then echo "npm"
              else echo "unknown"
              fi
            }

            PM=$(detect_package_manager)
            echo "Detected package manager: $PM"

            # ----------------------------
            # 运行 lint
            # ----------------------------
            echo "Running lint..."
            case $PM in
              bun)   $PM run lint ;;
              pnpm)  $PM run lint ;;
              yarn)  $PM run lint ;;
              npm)   $PM run lint ;;
              *)     echo "No package manager detected, skipping lint"; exit 0 ;;
            esac

            if [ $? -ne 0 ]; then
              echo '{"decision": "block", "reason": "Lint failed. Fix errors before committing."}'
              exit 2
            fi

            # ----------------------------
            # 检查代码格式
            # ----------------------------
            echo "Checking code format..."
            case $PM in
              bun)   $PM run format:check ;;
              pnpm)  $PM run format:check ;;
              yarn)  $PM run format:check ;;
              npm)   $PM run format:check ;;
              *)     exit 0 ;;
            esac

            if [ $? -ne 0 ]; then
              echo '{"decision": "warn", "reason": "Code not formatted. Run bun run format to fix."}'
              exit 1
            fi

            # ----------------------------
            # 运行测试（可选）
            # ----------------------------
            echo "Running tests..."
            case $PM in
              bun)   $PM test ;;
              pnpm)  $PM test ;;
              yarn)  $PM test ;;
              npm)   $PM test ;;
              *)     exit 0 ;;
            esac

            if [ $? -ne 0 ]; then
              echo '{"decision": "block", "reason": "Tests failed. Fix tests before committing."}'
              exit 2
            fi

            echo "All checks passed!"
            exit 0
```

### 关键设计点

#### 1. 拦截 --no-verify

```bash
if echo "$CMD" | grep -qE '\-\-no\-verify|-n'; then
  echo '{"decision": "block", "reason": "Use of --no-verify is not allowed"}'
  exit 2
fi
```

**作用：** 防止用户通过 `--no-verify` 绕过 hooks。

#### 2. 自动检测包管理器

```bash
detect_package_manager() {
  if [ -f "bun.lockb" ]; then echo "bun"
  elif [ -f "pnpm-lock.yaml" ]; then echo "pnpm"
  elif [ -f "yarn.lock" ]; then echo "yarn"
  elif [ -f "package-lock.json" ]; then echo "npm"
  else echo "unknown"
  fi
}
```

**好处：** 同一套 hook 配置可以在多个项目中使用，自动适配不同的包管理器。

#### 3. 渐进式检查

```
git commit
    ↓
检测 --no-verify ─→ 阻止
    ↓
运行 lint ─→ 失败 ─→ 阻止
    ↓
检查格式 ─→ 未格式化 ─→ 警告（但继续）
    ↓
运行测试 ─→ 失败 ─→ 阻止
    ↓
全部通过 ─→ 执行 commit
```

### 进阶优化

#### 跳过特定文件的检查

```bash
# 检查是否有跳过标记
if echo "$CMD" | grep -qE '\-\-no\-lint'; then
  echo "Skipping lint check for this commit"
  exit 0
fi
```

#### 并行运行检查

```bash
# 并行运行 lint 和 format:check
lint_result="pending"
format_result="pending"

bun run lint & lint_pid=$!
bun run format:check & format_pid=$!

wait $lint_pid && lint_result="pass" || lint_result="fail"
wait $format_pid && format_result="pass" || format_result="fail"
```

---

## 场景 3：非工作时间敏感操作确认（待实现）

### 需求分析

- 在非工作时间（晚上 22:00 - 早上 8:00）执行敏感操作时，要求二次确认
- 敏感操作包括：删除文件、部署代码、修改配置等

### 设计思路

**使用的事件：** `PermissionRequest`

**关键点：**
- 检测当前时间
- 如果是非工作时间，显示额外的确认提示
- 可以结合 prompt hook 让 LLM 决策

### 伪代码实现

```yaml
hooks:
  permissionRequest:
    - matcher: "Bash | Edit | Write"
      hooks:
        - type: prompt
          prompt: |
            当前时间是 $CURRENT_TIME。

            检查这个操作是否敏感：
            - Bash: 删除文件、部署命令、系统修改
            - Edit/Write: 修改配置文件、密钥文件

            如果是敏感操作且在非工作时间（22:00-8:00），返回：
            {"decision": "ask", "reason": "非工作时间，请确认是否继续"}

            其他情况返回：
            {"decision": "passthrough"}
```

---

## 附录：Hook 类型选择指南

| 场景 | 推荐类型 | 原因 |
|------|---------|------|
| 已知危险模式拦截 | `command` | 快速、精确、无需 LLM |
| 复杂语义判断 | `prompt` | 灵活、智能、可理解上下文 |
| 跨事件状态追踪 | `function` | 可访问 AppState |
| 外部 API 验证 | `http` | 调用远程服务 |
| 嵌套 agent 任务 | `agent` | 复杂工作流 |

---

## 参考资料

- Claude Code 源码：`src/utils/hooks.ts`
- SKILL.md 规范：`.claude/skills/teach-me/records/skill-hooks/session.md`
- 详细理论学习：`learn-examples/docs/10-skill-hooks-deep-dive.md`
