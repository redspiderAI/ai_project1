#Requires -Version 5.1
# Windows PowerShell 5.x：请用「UTF-8 带 BOM」保存本文件，避免中文乱码（VS Code / Cursor 右下角编码可选「UTF-8 with BOM」）。
<#
  部署 ai_pred 到 http://118.25.96.187/（站点根路径，非 /project2/）。

  SSH 使用 ~/.ssh/config 中的 Host（默认与下列一致即可）:
    Host Red_spider_bc
        HostName 118.25.96.187
        IdentityFile ~/.ssh/redspiderbc.pem
        User ubuntu

  行为:
    - 首次: 远端创建 Web 目录（若尚无 index.html）、上传 dist、可选修正权限。
    - 再次执行: 同样流程，仅覆盖静态文件（增量更新）。

  构建使用 base=/（见 package.json 中 build:deploy-root），与根路径访问一致。

  用法（在项目根目录）:
    .\deploy-redspiderbc.ps1
    npm run deploy:118
    .\deploy-redspiderbc.ps1 -SkipNpmInstall          # 更新依赖未改时略过 npm install
    .\deploy-redspiderbc.ps1 -SkipBuild               # 仅上传已有 dist
    .\deploy-redspiderbc.ps1 -FixRemotePerms          # 上传后 ssh chmod，便于 nginx 读文件

  环境变量（可选）:
    DEPLOY_HOST       SSH Host 别名，默认 Red_spider_bc
    DEPLOY_USER       默认 ubuntu
    DEPLOY_PATH       远端静态根目录，默认 /var/www/html
    DEPLOY_SITE_URL   部署完成提示用，默认 http://118.25.96.187/
    DEPLOY_SSH_KEY    若设置且存在则 scp/ssh 加 -i（一般可省略，沿用 config 的 IdentityFile）
    DEPLOY_FIX_REMOTE_PERMS  设为 1 等价于 -FixRemotePerms

  注意:
    - 需本机 OpenSSH（scp/ssh）；远端用户对 DEPLOY_PATH 可写（必要时: sudo chown -R ubuntu:ubuntu /var/www/html）。
    - 若 118 服务器 nginx root 不是 /var/www/html，请改 DEPLOY_PATH 并在服务器配置中对应。

  ---------- 服务器需要具备的条件（118 或其它 Ubuntu 云主机） ----------
  - 操作系统: 常见为 Ubuntu 20.04/22.04（其它 Linux 同理，路径按发行版调整）。
  - Web 服务: Nginx（或 Caddy 等）提供静态文件；**不需要**在服务器安装 Node.js——构建在你本机完成，上传的是 dist 静态资源。
  - 目录: 默认将文件放到 /var/www/html，与 nginx 的 root 一致；首次部署前确保该目录存在且部署用户可写。
  - Nginx SPA 示例（root 与 DEPLOY_PATH 一致时）:
        location / {
            try_files $uri $uri/ /index.html;
        }
    配置后执行: 先 sudo nginx -t，再 sudo systemctl reload nginx
  - 本仓库前端还会请求 /tl、/auth、/delivery-history 等 API：须由 Nginx 反代到实际后端，或由浏览器直连已配置 CORS 的 API 域名（见 .env.production 中 VITE_API_BASE 等）。
  - 本机条件: Windows 10+ 自带 OpenSSH 客户端；已配置好 ssh config（Host Red_spider_bc）且能无密码或密钥登录。
#>

param(
  [switch] $SkipBuild,
  [switch] $SkipNpmInstall,
  [switch] $FixRemotePerms,
  [string] $ServerHost = '',
  [string] $ServerUser = '',
  [string] $RemotePath = '',
  [string] $SiteUrl = '',
  [string] $SshKey = ''
)

$ErrorActionPreference = "Stop"

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

$DeployHost = Resolve-DeployVar "DEPLOY_HOST" $ServerHost "Red_spider_bc"
$DeployUser = Resolve-DeployVar "DEPLOY_USER" $ServerUser "ubuntu"
$DeployRemotePath = Resolve-DeployVar "DEPLOY_PATH" $RemotePath "/var/www/html"
$DeploySiteUrl = Resolve-DeployVar "DEPLOY_SITE_URL" $SiteUrl "http://118.25.96.187/"
$DeploySshKey = Resolve-DeployVar "DEPLOY_SSH_KEY" $SshKey ""
$fixPermsEnv = [Environment]::GetEnvironmentVariable("DEPLOY_FIX_REMOTE_PERMS", "Process")
if (-not $FixRemotePerms -and $fixPermsEnv -eq "1") { $FixRemotePerms = $true }

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$deployPathNormalized = $DeployRemotePath.TrimEnd('/', '\')

Write-Host ('==> 项目目录: ' + $Root) -ForegroundColor Cyan
Write-Host ('==> 目标: ' + $DeployUser + '@' + $DeployHost + ':' + $deployPathNormalized + '/') -ForegroundColor Cyan
Write-Host ('==> 访问地址: ' + $DeploySiteUrl) -ForegroundColor Cyan

function Get-SshScpKeyArgs {
  if ($DeploySshKey -and (Test-Path -LiteralPath $DeploySshKey)) {
    Write-Host ('    使用密钥: ' + $DeploySshKey) -ForegroundColor Gray
    return @("-i", $DeploySshKey)
  }
  if ($DeploySshKey) {
    Write-Warning ('DEPLOY_SSH_KEY 文件不存在: ' + $DeploySshKey + ' - 使用 SSH config 默认密钥')
  }
  return @()
}

$keyArgs = Get-SshScpKeyArgs
$sshTarget = "${DeployUser}@${DeployHost}"

# ---------- 首次部署：确保目录存在（幂等，再次执行等同「更新」前的准备） ----------
Write-Host '==> 检查远端目录...' -ForegroundColor Cyan
# 传给远端 bash，避免在 Windows PowerShell 5.x 双引号串里出现 &&、{} 被误解析
$probeCmd = 'test -f ''' + $deployPathNormalized + '/index.html'' && echo HAS_INDEX || echo NO_INDEX'
$probe = & ssh @keyArgs $sshTarget $probeCmd 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warning '无法探测远端 index（可能首次连入或路径权限）。将继续尝试创建目录。'
}
$isFirst = $probe -notmatch "HAS_INDEX"
if ($isFirst) {
  Write-Host '==> 首次部署：mkdir -p 远端目录...' -ForegroundColor Yellow
  $mk = 'mkdir -p ''' + $deployPathNormalized + ''''
  & ssh @keyArgs $sshTarget $mk
  if ($LASTEXITCODE -ne 0) {
    $mkdirHint = 'ssh 创建目录失败。请在服务器上执行: sudo mkdir -p ' + $deployPathNormalized + ' ; sudo chown -R ' + $DeployUser + ':' + $DeployUser + ' ' + $deployPathNormalized
    Write-Error $mkdirHint
  }
} else {
  Write-Host '    已存在 index.html，按「更新」覆盖静态文件。' -ForegroundColor Gray
}

# ---------- 构建（站点根路径 base=/） ----------
if (-not $SkipBuild) {
  if (-not $SkipNpmInstall) {
    Write-Host '==> npm install...' -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  } else {
    Write-Host '==> 已跳过 npm install (-SkipNpmInstall)' -ForegroundColor Yellow
  }

  Write-Host '==> npm run build:deploy-root（base=/）...' -ForegroundColor Cyan
  npm run build:deploy-root
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
  Write-Host '==> 已跳过构建 (-SkipBuild)' -ForegroundColor Yellow
}

if (-not (Test-Path -Path (Join-Path $Root "dist\index.html"))) {
  Write-Error 'dist\index.html 不存在，请先构建或去掉 -SkipBuild'
}

# ---------- 上传 ----------
Write-Host '==> 上传 dist -> 远端...' -ForegroundColor Cyan
$distFolder = Join-Path $Root "dist"
$scpTarget = "${sshTarget}:${deployPathNormalized}/"
$scpArgs = @() + $keyArgs + @("-r", "${distFolder}/.", $scpTarget)
& scp @scpArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error 'scp 失败，请检查 SSH、密钥与远端写权限'
}

if ($FixRemotePerms) {
  Write-Host '==> 修正远端权限（755/644）...' -ForegroundColor Cyan
  $rp = $deployPathNormalized
  $fb = [string][char]123 + [string][char]125
  & ssh @keyArgs $sshTarget ('chmod 755 ' + $rp)
  & ssh @keyArgs $sshTarget ('chmod 755 ' + $rp + '/assets')
  & ssh @keyArgs $sshTarget ('find ' + $rp + ' -type d -exec chmod 755 ' + $fb + ' +')
  & ssh @keyArgs $sshTarget ('find ' + $rp + ' -type f -exec chmod 644 ' + $fb + ' +')
  if ($LASTEXITCODE -ne 0) {
    Write-Error 'ssh 修正权限失败'
  }
}

Write-Host ('==> 完成: ' + $DeploySiteUrl) -ForegroundColor Green
Write-Host ('    Nginx root: ' + $deployPathNormalized) -ForegroundColor Gray
Write-Host '    Reload: sudo nginx -t' -ForegroundColor Gray
Write-Host '    Reload: sudo systemctl reload nginx' -ForegroundColor Gray
