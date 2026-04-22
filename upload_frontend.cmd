@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul

REM ===============================
REM AI 前端上传脚本（Windows CMD）
REM ===============================

REM 项目目录
set "PROJECT_DIR=C:\Users\ysc02\Desktop\66\ai_project1"
set "LOCAL_DIR=%PROJECT_DIR%\dist"

REM 服务器信息
set "REMOTE_USER=ubuntu"
set "REMOTE_HOST=118.25.96.187"
set "REMOTE_PORT=22"
REM 主发布目录（Nginx 常见目录）
set "REMOTE_DIR=/var/www/html/project2"
REM 兼容目录（你服务器文件树中存在 /home/ubuntu/var/www/ai_project1）
set "REMOTE_DIR_FALLBACK=/home/ubuntu/var/www/ai_project1"

REM SSH 私钥
set "SSH_KEY=C:\Users\ysc02\.ssh\redspiderbc.pem"

echo.
echo [1/6] 检查 ssh/tar 命令...
where ssh >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未找到 ssh，请先安装 OpenSSH Client。
  exit /b 1
)
where tar >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未找到 tar（Windows 10+ 通常自带 bsdtar）。
  exit /b 1
)

echo [2/6] 检查本地目录...
if not exist "%PROJECT_DIR%" (
  echo [ERROR] 项目目录不存在：%PROJECT_DIR%
  exit /b 1
)

echo [3/6] 构建生产包...
cd /d "%PROJECT_DIR%"
call npm run build
if errorlevel 1 (
  echo [ERROR] 构建失败，已中止。
  exit /b 1
)

if not exist "%LOCAL_DIR%\index.html" (
  echo [ERROR] dist\index.html 不存在，构建产物异常。
  exit /b 1
)

echo [4/6] 测试 SSH 连通性...
set "SSH_OPTS=-o BatchMode=yes -o StrictHostKeyChecking=no -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no -o NumberOfPasswordPrompts=0 -o ConnectTimeout=10 -o ConnectionAttempts=1 -o ServerAliveInterval=5 -o ServerAliveCountMax=1"
ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "echo SSH_OK"
if errorlevel 1 (
  echo [ERROR] SSH 连接失败（密钥/指纹/端口/网络问题）。
  echo 建议先手动执行：
  echo ssh -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST%
  exit /b 1
)

echo [5/6] 开始上传...
echo LOCAL  : %LOCAL_DIR%
echo REMOTE1: %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_DIR%
echo REMOTE2: %REMOTE_USER%@%REMOTE_HOST%:%REMOTE_DIR_FALLBACK%
echo.

echo [6/6] 跳过主目录直传（避免卡住）：%REMOTE_DIR%

echo [6/6] 上传到兼容目录...
ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "sh -lc 'timeout 12s bash -lc ""mkdir -p %REMOTE_DIR_FALLBACK% && test -w %REMOTE_DIR_FALLBACK%""'"
if errorlevel 1 (
  echo [WARN] 兼容目录不可写：%REMOTE_DIR_FALLBACK%
) else (
  tar -cf - -C "%LOCAL_DIR%" . | ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "sh -lc 'timeout 60s tar -xf - -C %REMOTE_DIR_FALLBACK%'"
  if errorlevel 1 (
    echo [WARN] 兼容目录上传失败：%REMOTE_DIR_FALLBACK%
  ) else (
    echo [OK] 兼容目录上传成功：%REMOTE_DIR_FALLBACK%
  )
)

echo.
echo [SYNC] 若主目录不可写，尝试使用 sudo 同步到主目录...
ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "sudo -n mkdir -p %REMOTE_DIR% && sudo -n cp -a %REMOTE_DIR_FALLBACK%/. %REMOTE_DIR%/ && sudo -n chown -R www-data:www-data %REMOTE_DIR% && echo SYNC_OK"
if errorlevel 1 (
  echo [WARN] sudo 同步未执行（可能需要服务器输入 sudo 密码）。
  echo [HINT] 你可在服务器手动执行以下命令完成一次性修复：
  echo sudo mkdir -p %REMOTE_DIR%
  echo sudo cp -a %REMOTE_DIR_FALLBACK%/. %REMOTE_DIR%/
  echo sudo chown -R www-data:www-data %REMOTE_DIR%
)

echo.
echo [VERIFY] 远端主目录最新文件:
ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "ls -lah %REMOTE_DIR% | sed -n '1,20p'"
echo.
echo [VERIFY] 远端兼容目录最新文件:
ssh %SSH_OPTS% -p %REMOTE_PORT% -i "%SSH_KEY%" %REMOTE_USER%@%REMOTE_HOST% "ls -lah %REMOTE_DIR_FALLBACK% | sed -n '1,20p'"

echo.
echo 上传完成。
echo 请强刷浏览器验证：Ctrl+F5
echo 访问地址：
echo https://redspiderbc.cn/project2/
exit /b 0
