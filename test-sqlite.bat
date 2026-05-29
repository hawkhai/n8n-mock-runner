@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

set ROOT=%~dp0
set SQLITE_DIR=%ROOT%..\n8n-nodes-sqlite
set MOCK_DIR=%ROOT%

echo ============================================================
echo  n8n-mock-runner x n8n-nodes-sqlite  test
echo ============================================================
echo.

:: ── Step 1: n8n-nodes-sqlite  node_modules ─────────────────────
echo [1/4] Checking n8n-nodes-sqlite dependencies...
if not exist "%SQLITE_DIR%\node_modules" (
    echo      node_modules not found, running npm install...
    pushd "%SQLITE_DIR%"
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed for n8n-nodes-sqlite
        goto :fail
    )
    popd
) else (
    echo      node_modules OK
)

:: ── Step 2: n8n-nodes-sqlite  dist ─────────────────────────────
echo.
echo [2/4] Building n8n-nodes-sqlite...
if not exist "%SQLITE_DIR%\dist\nodes\SQLite\Sqlite.node.js" (
    echo      dist not found, running npm run build...
    pushd "%SQLITE_DIR%"
    npm run build
    if errorlevel 1 (
        echo [ERROR] build failed for n8n-nodes-sqlite
        goto :fail
    )
    popd
) else (
    echo      dist OK
)

:: ── Step 3: n8n-mock-runner  node_modules ──────────────────────
echo.
echo [3/4] Checking n8n-mock-runner dependencies...
if not exist "%MOCK_DIR%\node_modules" (
    echo      node_modules not found, running npm install...
    pushd "%MOCK_DIR%"
    npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed for n8n-mock-runner
        goto :fail
    )
    popd
) else (
    echo      node_modules OK
)

:: ── Step 4: run demo ────────────────────────────────────────────
echo.
echo [4/4] Running sqlite-demo.ts...
echo ============================================================
pushd "%MOCK_DIR%"
set NODE_OPTIONS=--no-deprecation
npx ts-node examples\sqlite-demo.ts
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
