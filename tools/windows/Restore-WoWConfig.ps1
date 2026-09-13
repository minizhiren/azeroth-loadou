$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$DefaultPortal = "https://azeroth-loadout.minizhiren.chatgpt.site"

function Stop-WithMessage([string]$Message) {
    Write-Host "`n[错误] $Message" -ForegroundColor Red
    Read-Host "按回车键退出"
    exit 1
}

function Find-RetailFolder {
    $candidates = @(
        "C:\Program Files (x86)\World of Warcraft\_retail_",
        "C:\Program Files\World of Warcraft\_retail_",
        "C:\Games\World of Warcraft\_retail_"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate "Wow.exe")) { return $candidate }
    }
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "请选择 World of Warcraft 文件夹或其中的 _retail_ 文件夹"
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
    $selected = $dialog.SelectedPath
    if ((Split-Path $selected -Leaf) -ne "_retail_") { $selected = Join-Path $selected "_retail_" }
    if (Test-Path (Join-Path $selected "Wow.exe")) { return $selected }
    return $null
}

try {
    Clear-Host
    Write-Host "======================================" -ForegroundColor DarkYellow
    Write-Host "  艾泽拉斯配置站 - 一键恢复配置" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor DarkYellow

    if (Get-Process -Name "Wow" -ErrorAction SilentlyContinue) {
        Stop-WithMessage "请先完全退出魔兽世界，再重新运行本工具。"
    }
    $retail = Find-RetailFolder
    if (-not $retail) { Stop-WithMessage "没有找到有效的正式服 _retail_ 目录。" }
    Write-Host "`n目标目录：$retail" -ForegroundColor Green

    $portal = Read-Host "配置站地址（直接回车使用 $DefaultPortal）"
    if ([string]::IsNullOrWhiteSpace($portal)) { $portal = $DefaultPortal }
    $portal = $portal.TrimEnd("/")
    $invite = Read-Host "队伍邀请码"
    $packageId = Read-Host "配置包编号"
    if ([string]::IsNullOrWhiteSpace($invite) -or [string]::IsNullOrWhiteSpace($packageId)) {
        Stop-WithMessage "邀请码和配置包编号不能为空。"
    }
    $headers = @{ "X-Invite-Code" = $invite }
    $metadata = Invoke-RestMethod -Uri "$portal/api/packages/$packageId" -Headers $headers
    $item = $metadata.package
    Write-Host "`n即将恢复：$($item.name)" -ForegroundColor Cyan
    Write-Host "上传者：$($item.uploader)"
    Write-Host "大小：$([Math]::Round($item.size_bytes / 1MB, 1)) MB"
    Write-Host "这会替换本机的 Interface 和 WTF；原目录会自动备份。" -ForegroundColor Yellow
    $confirm = Read-Host "确认继续？输入 RESTORE"
    if ($confirm -cne "RESTORE") { Stop-WithMessage "已取消，没有修改游戏文件。" }

    $work = Join-Path $env:TEMP ("WoWSync-Restore-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    $archive = Join-Path $work "wow-config.zip"
    $output = [IO.File]::Create($archive)
    try {
        for ($index = 0; $index -lt $item.total_parts; $index++) {
            Write-Host "下载分片 $($index + 1)/$($item.total_parts)…" -ForegroundColor Cyan
            $partPath = Join-Path $work ("part-{0:D3}.bin" -f $index)
            Invoke-WebRequest -UseBasicParsing -Uri "$portal/api/packages/$packageId/parts/$index" -Headers $headers -OutFile $partPath
            $input = [IO.File]::OpenRead($partPath)
            try { $input.CopyTo($output) } finally { $input.Dispose() }
            Remove-Item -LiteralPath $partPath -Force
        }
    } finally { $output.Dispose() }

    $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $item.sha256) { throw "SHA-256 校验失败，文件可能损坏，已停止恢复。" }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $extract = Join-Path $work "extracted"
    New-Item -ItemType Directory -Path $extract -Force | Out-Null
    $archiveObject = [IO.Compression.ZipFile]::OpenRead($archive)
    try {
        $safeRoot = ([IO.Path]::GetFullPath($extract)).TrimEnd("\") + "\"
        foreach ($entry in $archiveObject.Entries) {
            $destination = [IO.Path]::GetFullPath((Join-Path $extract $entry.FullName))
            if (-not $destination.StartsWith($safeRoot, [StringComparison]::OrdinalIgnoreCase)) {
                throw "压缩包包含不安全路径，已停止恢复。"
            }
        }
    } finally { $archiveObject.Dispose() }
    [IO.Compression.ZipFile]::ExtractToDirectory($archive, $extract)
    $sourceRetail = Join-Path $extract "_retail_"
    if (-not (Test-Path $sourceRetail)) { throw "压缩包格式不正确：缺少 _retail_。" }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = Join-Path $retail ("WoWSync-Backup-" + $stamp)
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $moved = @()
    foreach ($folder in @("Interface", "WTF")) {
        $current = Join-Path $retail $folder
        if (Test-Path $current) {
            Move-Item -LiteralPath $current -Destination (Join-Path $backup $folder)
            $moved += $folder
        }
    }
    try {
        foreach ($folder in @("Interface", "WTF")) {
            $sourceFolder = Join-Path $sourceRetail $folder
            if (Test-Path $sourceFolder) { Copy-Item -LiteralPath $sourceFolder -Destination (Join-Path $retail $folder) -Recurse -Force }
        }
    } catch {
        foreach ($folder in @("Interface", "WTF")) {
            $newFolder = Join-Path $retail $folder
            $oldFolder = Join-Path $backup $folder
            if (Test-Path $newFolder) { Remove-Item -LiteralPath $newFolder -Recurse -Force -ErrorAction SilentlyContinue }
            if (Test-Path $oldFolder) { Move-Item -LiteralPath $oldFolder -Destination $newFolder -Force }
        }
        throw
    }

    Write-Host "`n恢复完成！可以启动魔兽世界了。" -ForegroundColor Green
    Write-Host "原配置备份：$backup" -ForegroundColor Yellow
    Write-Host "如果插件提示版本过期，请先确认来源可信并更新插件。"
} catch {
    Write-Host "`n恢复失败：$($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($work -and (Test-Path $work)) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    Read-Host "`n按回车键退出"
}
