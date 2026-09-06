# repo-audit PowerShell shim
# 找到脚本所在目录的父目录，执行 repo-audit.mjs
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& node "$scriptDir\..\repo-audit.mjs" @args
