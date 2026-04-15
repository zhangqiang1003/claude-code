#!/bin/bash
# -*- coding: utf-8 -*-
echo "========================================"
echo "DMVideo Backend Nuitka 打包脚本"
echo "========================================"
echo

# 清理旧的打包文件
if [ -f "out/DMVideoBackend" ]; then
    echo "清理旧的打包文件..."
    rm -f out/DMVideoBackend
fi

echo "开始打包..."
echo

nuitka --standalone \
  --onefile \
  --output-dir=out \
  --output-filename=DMVideoBackend \
  --include-package=fastapi \
  --include-package=uvicorn \
  --include-package=starlette \
  --include-package=pydantic \
  --include-package=requests \
  --include-package=urllib3 \
  --include-package=httpcore \
  --include-package=httptools \
  --include-package=anyio \
  --include-package=sniffio \
  --include-package=click \
  --include-package=h11 \
  --include-package=pymediainfo \
  --include-package=imageio \
  --include-package=core \
  --include-package=pyJianYingDraft \
  --include-data-dir=pyJianYingDraft/assets=pyJianYingDraft/assets \
  --include-data-file=pyJianYingDraft/__init__.py=pyJianYingDraft/__init__.py \
  --assume-yes-for-downloads \
  --show-progress \
  --show-memory \
  main.py

if [ $? -eq 0 ]; then
    echo
    echo "========================================"
    echo "打包成功！输出文件: out/DMVideoBackend"
    echo "========================================"
else
    echo
    echo "========================================"
    echo "打包失败！请检查错误信息"
    echo "========================================"
fi
