# One command for everything:
#   npm run deploy:all
#   -> build, upload, merge /project3 into pd.conf via snippet (default; avoids duplicate server_name)
#   -> use -NginxStandaloneSite only if no pd.conf / no conflict
#
# Files only (no nginx):
#   npm run deploy
#
# Only fix nginx (after you changed template or port):
#   .\deploy.ps1 -NginxOnly
#   .\deploy.ps1 -NginxOnly -BackendPort 8000

param(
    [string]$RemoteUser = "ubuntu",
    [string]$ServerHost = "111.229.25.160",
    [int]$SshPort = 22,
    [string]$RemotePath = "/var/www/html/project3",
    [string]$KeyPath = "C:\Users\ysc02\.ssh\redspiderkey2.pem",
    [string]$StageName = "project3_staging",
    [switch]$WithNginx,
    [switch]$NginxOnly,
    [int]$BackendPort = 8002,
    [string]$NginxServerName = "",
    [string]$NginxPdConf = "/etc/nginx/sites-available/pd.conf",
    [switch]$NginxStandaloneSite,
    # project3=仅本仓库 /project3；all123=同文件含 /project1 /project2 /project3（需服务器上已有对应目录）
    [ValidateSet('project3', 'all123')]
    [string]$NginxSnippet = 'project3'
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$envPort = $env:DEPLOY_SSH_PORT
if ($envPort -match '^\d+$') {
    $SshPort = [int]$envPort
}

if (-not (Test-Path $KeyPath)) {
    Write-Error "SSH key not found: $KeyPath"
}

$nginxName = $NginxServerName
if ([string]::IsNullOrWhiteSpace($nginxName)) {
    $nginxName = $ServerHost
}

$portStr = [string]$SshPort
$target = "${RemoteUser}@${ServerHost}"
$stageRemote = "~/${StageName}"

$commonSshOpts = @(
    '-o', 'ConnectTimeout=25',
    '-o', 'ServerAliveInterval=5',
    '-o', 'ServerAliveCountMax=12',
    '-o', 'StrictHostKeyChecking=accept-new'
)

function Invoke-DeploySsh {
    param([Parameter(Mandatory)][string]$RemoteCommand)
    $all = @(
        '-i', $KeyPath,
        '-p', $portStr
    ) + $commonSshOpts + @($target, $RemoteCommand)
    & ssh.exe @all
}

function Invoke-DeployScpToStaging {
    param([Parameter(Mandatory)][string[]]$LocalPaths)
    $all = @(
        '-i', $KeyPath,
        '-P', $portStr
    ) + $commonSshOpts + @('-r') + $LocalPaths + @("${target}:${stageRemote}/")
    & scp.exe @all
}

function Invoke-ScpOneFile {
    param(
        [Parameter(Mandatory)][string]$LocalFile,
        [Parameter(Mandatory)][string]$RemotePath
    )
    $all = @(
        '-i', $KeyPath,
        '-P', $portStr
    ) + $commonSshOpts + @($LocalFile, "${target}:${RemotePath}")
    & scp.exe @all
}

function Test-DeploySsh {
    Write-Host ">> SSH test: ${target} (port ${portStr})..." -ForegroundColor Cyan
    Invoke-DeploySsh -RemoteCommand 'echo connected && uname -n'
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Cannot reach SSH." -ForegroundColor Yellow
        Write-Host "Test: Test-NetConnection -ComputerName $ServerHost -Port $portStr" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

function Invoke-PushNginxConfig {
    param(
        [int]$ApiPort,
        [string]$ServerNameForNginx,
        [string]$PdConfPath,
        [switch]$StandaloneSite,
        [string]$SnippetVariant = 'project3'
    )

    Write-Host ""

    if ($StandaloneSite.IsPresent) {
        $tpl = Join-Path $ProjectRoot 'deploy\nginx-site.template'
        if (-not (Test-Path $tpl)) { Write-Error "Missing template: $tpl" }
        Write-Host ">> Nginx: standalone site 00-ai-frontend-project3 (use only if no duplicate server_name)" -ForegroundColor Yellow
        $text = [System.IO.File]::ReadAllText($tpl)
        $text = $text -replace '__API_PORT__', ([string]$ApiPort)
        $text = $text -replace '__SERVER_NAME__', $ServerNameForNginx
        $tmpLocal = Join-Path $env:TEMP ("nginx_ai_deploy_{0}.conf" -f [Guid]::NewGuid().ToString('N').Substring(0, 8))
        [System.IO.File]::WriteAllText($tmpLocal, $text, [System.Text.UTF8Encoding]::new($false))
        try {
            Invoke-ScpOneFile -LocalFile $tmpLocal -RemotePath '/tmp/nginx_ai_deploy.conf'
            if ($LASTEXITCODE -ne 0) { Write-Error "scp nginx config failed" }
            $remoteScript = 'set -e; TS=$(date +%s); AV=/etc/nginx/sites-available/ai-frontend-project3.conf; EN=/etc/nginx/sites-enabled/00-ai-frontend-project3.conf; if [ -f "$AV" ]; then sudo cp "$AV" "$AV.bak.$TS"; fi; sudo cp /tmp/nginx_ai_deploy.conf "$AV"; sudo ln -sf "$AV" "$EN"; sudo nginx -t; sudo systemctl reload nginx; rm -f /tmp/nginx_ai_deploy.conf; echo nginx_ok'
            Write-Host ">> Nginx: write ai-frontend-project3.conf + symlink" -ForegroundColor Cyan
            Invoke-DeploySsh -RemoteCommand $remoteScript
            if ($LASTEXITCODE -ne 0) { Write-Error "nginx -t or reload failed" }
        } finally {
            Remove-Item -LiteralPath $tmpLocal -Force -ErrorAction SilentlyContinue
        }
    } else {
        $snipFile = if ($SnippetVariant -eq 'all123') { 'nginx-snippet-project1-2-3.conf' } else { 'nginx-snippet-project3.conf' }
        $snip = Join-Path $ProjectRoot ('deploy\' + $snipFile)
        $patch = Join-Path $ProjectRoot 'deploy\patch_pd_nginx.py'
        if (-not (Test-Path $snip)) { Write-Error "Missing $snip" }
        if (-not (Test-Path $patch)) { Write-Error "Missing $patch" }
        Write-Host ">> Nginx: merge snippet into existing pd.conf (snippet + include line) [$snipFile]" -ForegroundColor Yellow
        Write-Host ">>         match server_name containing: $ServerNameForNginx" -ForegroundColor DarkGray
        Write-Host ">>         pd.conf: $PdConfPath" -ForegroundColor DarkGray
        Invoke-ScpOneFile -LocalFile $snip -RemotePath '/tmp/ai_project3_snippet.conf'
        if ($LASTEXITCODE -ne 0) { Write-Error "scp snippet failed" }
        Invoke-ScpOneFile -LocalFile $patch -RemotePath '/tmp/patch_pd_nginx.py'
        if ($LASTEXITCODE -ne 0) { Write-Error "scp patch script failed" }
        $remoteScript = "set -e; sudo mkdir -p /etc/nginx/snippets; sudo cp /tmp/ai_project3_snippet.conf /etc/nginx/snippets/ai-frontend-project3.conf; sudo python3 /tmp/patch_pd_nginx.py '$ServerNameForNginx' '$PdConfPath'; sudo rm -f /etc/nginx/sites-enabled/00-ai-frontend-project3.conf /etc/nginx/sites-available/ai-frontend-project3.conf; sudo nginx -t; sudo systemctl reload nginx; echo nginx_ok"
        Write-Host ">> Nginx: install snippet, patch pd.conf, remove duplicate site if any, nginx -t, reload" -ForegroundColor Cyan
        Invoke-DeploySsh -RemoteCommand $remoteScript
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Merge failed. SSH to server: sudo python3 /tmp/patch_pd_nginx.py '$ServerNameForNginx' '$PdConfPath'  (or add include line by hand in pd.conf)"
        }
    }

    Write-Host ">> Nginx OK." -ForegroundColor Green

    Write-Host ""
    Write-Host ">> Check /project3 on server..." -ForegroundColor Cyan
    # Do NOT curl 127.0.0.1 with manual Host: some stacks reject it with 400.
    # If pd.conf uses listen 80 proxy_protocol, ANY client without PROXY (incl. curl to VM IP) gets 400.
    $diag = 'echo ===assets-on-disk===; sudo ls -la /var/www/html/project3/assets/ 2>&1 | head -15 || true; echo ===pd-listen-lines===; sudo grep -n listen ' + $PdConfPath + ' 2>/dev/null || true; echo ===snippet-file===; sudo sed -n 1,45p /etc/nginx/snippets/ai-frontend-project3.conf 2>/dev/null || true; echo ===curl-index===; curl -sI -m 15 http://' + $ServerNameForNginx + '/project3/ 2>&1 | head -18 || true; echo ===curl-one-js===; J=$(sudo ls /var/www/html/project3/assets/*.js 2>/dev/null | head -1); echo "js=$J"; if [ -n "$J" ]; then curl -sI -m 10 http://' + $ServerNameForNginx + '/project3/assets/$(basename "$J") 2>&1 | head -14; fi; echo ===http-code-index===; curl -s -o /dev/null -w "%{http_code}\n" -m 15 http://' + $ServerNameForNginx + '/project3/ 2>&1 || true'
    Invoke-DeploySsh -RemoteCommand $diag
    Write-Host ""
    Write-Host "If http-code is 400: open pd.conf and check listen 80. If you see proxy_protocol, browsers/curl must connect through a load balancer that sends PROXY," -ForegroundColor Yellow
    Write-Host "or add a second listen without proxy (e.g. listen 127.0.0.1:8080) for local testing." -ForegroundColor Yellow
}

Test-DeploySsh

if (-not $NginxOnly) {
    Write-Host ">> npm run build" -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    $dist = Join-Path $ProjectRoot "dist"
    if (-not (Test-Path $dist)) {
        Write-Error "dist folder missing."
    }

    Write-Host ">> Prepare staging: $stageRemote" -ForegroundColor Cyan
    Invoke-DeploySsh -RemoteCommand "rm -rf $stageRemote && mkdir -p $stageRemote"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Could not create staging dir."
    }

    Write-Host ">> scp dist -> server..." -ForegroundColor Cyan
    $children = @(Get-ChildItem -Path $dist -Force)
    if ($children.Count -eq 0) {
        Write-Error "dist is empty."
    }
    $paths = @($children | ForEach-Object { $_.FullName })
    Invoke-DeployScpToStaging -LocalPaths $paths
    if ($LASTEXITCODE -ne 0) {
        Write-Error "scp failed."
    }

    Write-Host ">> sudo copy -> $RemotePath" -ForegroundColor Cyan
    # cp from home often leaves dirs as 700: nginx (www-data) cannot enter -> 403 on /assets/*.js
    $remoteCmd = (
        "sudo mkdir -p '{0}' && sudo rm -rf '{0}'/* && sudo cp -a {1}/. '{0}/' && rm -rf {1} && sudo find '{0}' -type d -exec chmod 755 {{}} + && sudo find '{0}' -type f -exec chmod 644 {{}} +" `
            -f $RemotePath, $stageRemote
    )
    Write-Host ">> chmod dirs 755 / files 644 under $RemotePath (for www-data)" -ForegroundColor DarkGray
    Invoke-DeploySsh -RemoteCommand $remoteCmd
    if ($LASTEXITCODE -ne 0) {
        Write-Error "sudo copy failed. Try: .\deploy.ps1 -RemoteUser root"
    }

    Write-Host ""
    Write-Host "Static files OK: http://${ServerHost}/project3/" -ForegroundColor Green
}

if ($WithNginx -or $NginxOnly) {
    Invoke-PushNginxConfig -ApiPort $BackendPort -ServerNameForNginx $nginxName -PdConfPath $NginxPdConf -StandaloneSite:$NginxStandaloneSite -SnippetVariant $NginxSnippet
}

if (-not $WithNginx -and -not $NginxOnly) {
    Write-Host ""
    Write-Host 'If URL shows JSON {"detail":"Not Found"}, run: npm run deploy:all' -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "All done." -ForegroundColor Green
