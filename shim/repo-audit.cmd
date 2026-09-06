@echo off
:: repo-audit Windows CMD shim
:: 找到脚本所在目录的父目录，执行 repo-audit.mjs
setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
set "NODE_SCRIPT=%SCRIPT_DIR%..\repo-audit.mjs"
node "%NODE_SCRIPT%" %*
