#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo -e "${BLUE}=== SEO Pro Tool — Deploy ===${NC}"
echo ""

# Check for uncommitted changes
if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain)" ]; then
  echo -e "${YELLOW}Không có thay đổi nào để commit.${NC}"
  echo -e "Push commit hiện tại lên GitHub? (y/n): \c"
  read -r PUSH_ONLY
  if [[ "$PUSH_ONLY" != "y" ]]; then
    echo "Hủy deploy."
    exit 0
  fi
else
  # Show changed files
  echo -e "${YELLOW}Các file thay đổi:${NC}"
  git status --short
  echo ""

  # Commit message
  if [ -n "$1" ]; then
    MSG="$1"
  else
    echo -e "Nhập commit message (Enter để dùng mặc định): \c"
    read -r MSG
    if [ -z "$MSG" ]; then
      MSG="deploy: update $(date '+%Y-%m-%d %H:%M')"
    fi
  fi

  git add -A
  git commit -m "$MSG"
  echo -e "${GREEN}✓ Committed: $MSG${NC}"
fi

# Push to GitHub (triggers Railway + Vercel auto-deploy)
echo ""
echo -e "${BLUE}Đang push lên GitHub...${NC}"
git push origin main
echo -e "${GREEN}✓ Pushed to GitHub${NC}"

echo ""
echo -e "${GREEN}=== Deploy đang chạy ===${NC}"
echo -e "  Railway (backend) tự build từ GitHub push"
echo -e "  Vercel  (frontend) tự build từ GitHub push"
echo ""
echo -e "${BLUE}Theo dõi:${NC}"
echo -e "  Backend logs : https://railway.app"
echo -e "  Frontend logs: https://vercel.com/dashboard"
echo -e "  Health check : https://seo-tool-production-99c0.up.railway.app/health"
echo ""
echo -e "${YELLOW}Thường mất 1-3 phút để deploy xong.${NC}"
