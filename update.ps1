#Requires -Version 5.1
# 一键：npm 构建 + scp 上传 + 远端 chmod（nginx 可读）。等价于 deploy.ps1 -FixRemotePerms

param([switch]$SkipBuild)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
& "$Root\deploy.ps1" -FixRemotePerms -SkipBuild:$SkipBuild
