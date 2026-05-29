@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set ROOT=%~dp0
set MOCK_DIR=%ROOT%

echo ============================================================
echo  n8n-mock-runner x n8n-nodes-pdfco  test
echo ============================================================
echo.

:: ── Step 1: n8n-mock-runner  node_modules ────────────────────────────────────
echo [1/2] Checking n8n-mock-runner dependencies...
if not exist "%MOCK_DIR%\node_modules\n8n-nodes-pdfco" (
    echo      n8n-nodes-pdfco not found, running npm install...
    pushd "%MOCK_DIR%"
    npm install --ignore-scripts
    if errorlevel 1 (
        echo [ERROR] npm install failed for n8n-mock-runner
        goto :fail
    )
    popd
) else (
    echo      node_modules OK
)

:: ── Step 2: run demo ──────────────────────────────────────────────────────────
echo.
echo [2/2] Running pdfco-demo.ts...
echo ============================================================
pushd "%MOCK_DIR%"
set NODE_OPTIONS=--no-deprecation
npx ts-node examples\pdfco-demo.ts
set EXIT_CODE=!errorlevel!
popd

echo ============================================================
if !EXIT_CODE! == 0 (
    echo  PASSED
) else (
    echo  FAILED  ^(exit code: !EXIT_CODE!^)
)
echo ============================================================
goto :end

:fail
echo.
echo ============================================================
echo  Setup FAILED — see errors above
echo ============================================================
exit /b 1

:end
exit /b !EXIT_CODE!
