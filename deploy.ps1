#Requires -Version 5.1
<#
  部署 ai_pred 到服务器 /var/www/html/project2（与 vite base /project2/ 一致，访问 http://<host>/project2/）。
  仅向该子目录内 scp 写入，不会改动同级的 project1、project3；且脚本会拒绝「最后一级不是 project2」的路径，避免误覆盖整个 html 目录。

  默认按 ~/.ssh/config 中的 Host 别名连接（与下列配置一致即可，无需再传 -i）:
    Host Red_spider_api2
        HostName 111.229.25.160
        IdentityFile ~/.ssh/redspiderkey2.pem
        User ubuntu

  用法（在项目根目录执行）:
    .\deploy.ps1
    .\deploy.ps1 -SkipBuild
    .\deploy.ps1 -FixRemotePerms
    .\update.ps1
    npm run update
    .\deploy.ps1 -SshKey "D:\keys\other.pem"
    $env:DEPLOY_HOST = "111.229.25.160"; .\deploy.ps1

  环境变量（可选）:
    DEPLOY_HOST       scp 连接用主机，默认 Red_spider_api2（SSH config 里的 Host；改为 IP 时需自行配置密钥或设 DEPLOY_SSH_KEY）
    DEPLOY_USER       SSH 用户，默认 ubuntu
    DEPLOY_SITE_HOST  浏览器访问域名/IP，默认 111.229.25.160（仅用于部署完成提示，不参与 scp）
    DEPLOY_PATH       远端目录，默认 /var/www/html/project2（必须为名为 project2 的目录，不可设为 /var/www/html）
    DEPLOY_SSH_KEY    若设置且文件存在，则 scp 加 -i；未设置则完全依赖 SSH config 的 IdentityFile
    DEPLOY_FIX_REMOTE_PERMS  设为 1 时等价于 -FixRemotePerms（上传后 SSH 执行 chmod，便于 nginx 读静态文件）
    VITE_API_BASE     若接口非同源，构建前设置，例如 http://111.229.25.160:8001/api/v1

  注意: 若 scp 报权限 denied，请在服务器上保证该用户对 /var/www/html/project2 可写（例如 sudo chown -R ubuntu:ubuntu /var/www/html/project2）。

  依赖: 本机已安装 Node.js、npm；本机有 scp（Windows 10+ 可选功能 OpenSSH 客户端）。
#>

param(
  [switch] $SkipBuild,
  [switch] $FixRemotePerms,
  [string] $ServerHost = '',
  [string] $ServerUser = '',
  [string] $RemotePath = '',
  [string] $SshKey = ''
)

$ErrorActionPreference = "Stop"

# Windows PowerShell 5.x：配合「UTF-8 带 BOM」保存本文件，避免中文乱码
try {
  $utf8Out = [System.Text.UTF8Encoding]::new($false)
  [Console]::OutputEncoding = $utf8Out
  $OutputEncoding = $utf8Out
  if ($PSVersionTable.PSVersion.Major -lt 6) {
    chcp 65001 | Out-Null
  }
} catch {}

function Resolve-DeployVar {
  param([string] $EnvName, [string] $ParamVal, [string] $Default)
  if ($ParamVal) { return $ParamVal }
  $e = [Environment]::GetEnvironmentVariable($EnvName, "Process")
  if ($e) { return $e }
  return $Default
}

$DeployHost = Resolve-DeployVar "DEPLOY_HOST" $ServerHost "Red_spider_api2"
$DeployUser = Resolve-DeployVar "DEPLOY_USER" $ServerUser "ubuntu"
$DeploySiteHost = Resolve-DeployVar "DEPLOY_SITE_HOST" "" "111.229.25.160"
$DeployRemotePath = Resolve-DeployVar "DEPLOY_PATH" $RemotePath "/var/www/html/project2"
$DeploySshKey = Resolve-DeployVar "DEPLOY_SSH_KEY" $SshKey ""
$fixPermsEnv = [Environment]::GetEnvironmentVariable("DEPLOY_FIX_REMOTE_PERMS", "Process")
if (-not $FixRemotePerms -and $fixPermsEnv -eq "1") { $FixRemotePerms = $true }

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$deployPathNormalized = $DeployRemotePath.TrimEnd('/', '\')
$deployPathLeaf = Split-Path -Leaf $deployPathNormalized
if ($deployPathLeaf -cne "project2") {
  Write-Error @"
DEPLOY_PATH 的最后一级必须是 project2，以免误写 /var/www/html 下的 project1、project3。
当前: $DeployRemotePath
请改为例如 /var/www/html/project2
"@
}

Write-Host "==> 项目目录: $Root" -ForegroundColor Cyan
Write-Host "==> 目标（仅 project2 目录）: ${DeployUser}@${DeployHost}:${DeployRemotePath}" -ForegroundColor Cyan

if (-not $SkipBuild) {
  Write-Host "==> npm install..." -ForegroundColor Cyan
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "==> npm run build..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host "==> 已跳过构建 (-SkipBuild)" -ForegroundColor Yellow
}

if (-not (Test-Path -Path (Join-Path $Root "dist\index.html"))) {
  Write-Error "dist\index.html 不存在，请先构建或去掉 -SkipBuild"
}

Write-Host "==> 上传 dist -> 远端 (${DeployRemotePath})..." -ForegroundColor Cyan
$distFolder = Join-Path $Root "dist"
$scpTarget = "${DeployUser}@${DeployHost}:${DeployRemotePath}/"
$scpArgs = @()
if ($DeploySshKey -and (Test-Path -LiteralPath $DeploySshKey)) {
  $scpArgs += "-i", $DeploySshKey
  Write-Host "    使用密钥: $DeploySshKey" -ForegroundColor Gray
} elseif ($DeploySshKey) {
  Write-Warning "DEPLOY_SSH_KEY 指定的文件不存在: $DeploySshKey — 将使用默认 SSH 配置（未传 scp -i）"
}
$scpArgs += "-r", "${distFolder}/.", $scpTarget
& scp @scpArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "scp 失败，请检查 SSH、密钥、路径与远端目录写权限"
}

if ($FixRemotePerms) {
  Write-Host "==> 修正远端目录权限（755/644，供 nginx 读取）..." -ForegroundColor Cyan
  $sshArgs = @()
  if ($DeploySshKey -and (Test-Path -LiteralPath $DeploySshKey)) {
    $sshArgs += "-i", $DeploySshKey
  }
  $sshTarget = "${DeployUser}@${DeployHost}"
  $rp = $deployPathNormalized
  $remoteSh = "chmod 755 '$rp' 2>/dev/null || true; chmod 755 '$rp/assets' 2>/dev/null || true; find '$rp' -type d -exec chmod 755 {} \; ; find '$rp' -type f -exec chmod 644 {} \;"
  & ssh @sshArgs $sshTarget $remoteSh
  if ($LASTEXITCODE -ne 0) {
    Write-Error "ssh 修正权限失败，请确认本机有 ssh 命令且远端用户可 chmod 该目录"
  }
}

Write-Host "==> 部署完成。站点: http://${DeploySiteHost}/project2/" -ForegroundColor Green
Write-Host "    若需重载 Nginx，在服务器执行: sudo nginx -t && sudo systemctl reload nginx" -ForegroundColor Gray
