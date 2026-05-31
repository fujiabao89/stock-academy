#!/usr/bin/env bash
# 会话结束时检查 Git 状态，提醒提交关键文件到远程仓库

set -euo pipefail

# 检查是否为 Git 仓库
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# 获取未提交的变更（已修改、已暂存、未跟踪）
UNSTAGED=$(git diff --name-only 2>/dev/null | wc -l | tr -d ' ')
STAGED=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
TOTAL_CHANGES=$((UNSTAGED + STAGED + UNTRACKED))

# 检查未推送的提交
REMOTE=$(git remote 2>/dev/null | head -1 || echo "")
if [ -n "$REMOTE" ]; then
  UNPUSHED=$(git log "@{u}..HEAD" --oneline 2>/dev/null | wc -l | tr -d ' ' || echo "0")
else
  UNPUSHED=0
fi

# 如果没有任何变更，静默退出
if [ "$TOTAL_CHANGES" -eq 0 ] && [ "$UNPUSHED" -eq 0 ]; then
  exit 0
fi

# 输出醒目的提醒
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚠️  提 交 提 醒"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$TOTAL_CHANGES" -gt 0 ]; then
  echo "  📝 未提交的变更: $TOTAL_CHANGES 个文件"
  echo "     ├─ 已暂存: $STAGED 个"
  echo "     ├─ 未暂存: $UNSTAGED 个"
  echo "     └─ 新文件: $UNTRACKED 个"
  echo ""

  # 列出具体文件（最多 20 个）
  echo "  📄 变更文件列表:"
  CHANGED_FILES=$( { git diff --cached --name-only 2>/dev/null; git diff --name-only 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | sort -u | head -20)
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    echo "     • $file"
  done <<< "$CHANGED_FILES"

  FILE_COUNT=$(echo "$CHANGED_FILES" | grep -c . || echo "0")
  if [ "$TOTAL_CHANGES" -gt "$FILE_COUNT" ]; then
    echo "     ... 还有 $((TOTAL_CHANGES - FILE_COUNT)) 个文件"
  fi
  echo ""
fi

if [ "$UNPUSHED" -gt 0 ]; then
  echo "  📤 未推送的提交: $UNPUSHED 个"
  git log "@{u}..HEAD" --oneline 2>/dev/null | head -5 | while IFS= read -r line; do
    echo "     • $line"
  done
  echo ""
fi

echo "  💡 建议操作:"
if [ "$TOTAL_CHANGES" -gt 0 ]; then
  echo "     git add <文件> && git commit -m \"描述你的改动\""
fi
if [ "$UNPUSHED" -gt 0 ] && [ -n "$REMOTE" ]; then
  echo "     git push $REMOTE $(git branch --show-current 2>/dev/null || echo "main")"
elif [ "$UNPUSHED" -gt 0 ]; then
  echo "     git remote add origin <远程仓库地址> && git push"
elif [ -z "$REMOTE" ]; then
  echo "     git remote add origin <远程仓库地址>  # 先关联远程仓库"
fi
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
