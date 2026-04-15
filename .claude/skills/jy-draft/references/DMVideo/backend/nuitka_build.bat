@echo off
echo ========================================
echo DMVideo Backend - Nuitka Build
echo ========================================
echo.

REM Clean old build folder
if exist out\DMVideoBackend (
    echo Cleaning old build folder...
    rmdir /s /q out\DMVideoBackend
)

echo Starting build...
echo.

nuitka --standalone ^
  --output-dir=out ^
  --output-filename=DMVideoBackend ^
  --include-package=fastapi ^
  --include-package=uvicorn ^
  --include-package=pydantic ^
  --include-package=requests ^
  --include-package=pymediainfo ^
  --include-package=imageio ^
  --include-package=core ^
  --include-package=pjy ^
  --include-data-dir=pjy/assets=pjy/assets ^
  --include-data-file=pjy/__init__.py=pjy/__init__.py ^
  --windows-console-mode=force ^
  --assume-yes-for-downloads ^
  --show-progress ^
  --show-memory ^
  main.py

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Build succeeded! Output: out\DMVideoBackend.exe
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Build failed! Check error messages above.
    echo ========================================
)
pause
