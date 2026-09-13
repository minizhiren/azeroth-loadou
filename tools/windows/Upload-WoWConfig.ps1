$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$DefaultPortal = "https://azeroth-loadout.minizhiren.chatgpt.site"
$PartSize = 64MB

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
    Write-Host "  艾泽拉斯配置站 - 上传我的配置" -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor DarkYellow

    if (Get-Process -Name "Wow" -ErrorAction SilentlyContinue) {
        Stop-WithMessage "请先完全退出魔兽世界，再重新运行本工具。"
    }

    $retail = Find-RetailFolder
    if (-not $retail) { Stop-WithMessage "没有找到有效的正式服 _retail_ 目录。" }
    Write-Host "`n已找到正式服：$retail" -ForegroundColor Green

    $interface = Join-Path $retail "Interface"
    $wtf = Join-Path $retail "WTF"
    if (-not (Test-Path $interface) -and -not (Test-Path $wtf)) {
        Stop-WithMessage "没有找到 Interface 或 WTF。请先启动一次游戏并安装插件。"
    }

    Write-Host "`n本工具将上传：" -ForegroundColor Cyan
    Write-Host "  - Interface\AddOns（完整插件文件）"
    Write-Host "  - WTF（按键、宏、界面与插件配置）"
    Write-Host "不会上传 Cache、Logs、Errors 或 Screenshots。"
    Write-Host "注意：WTF 中可能包含战网账号目录名、服务器名、角色名和插件保存的数据。" -ForegroundColor Yellow
    $consent = Read-Host "只与信任的队友分享。确认继续？输入 YES"
    if ($consent -cne "YES") { Stop-WithMessage "已取消，没有上传任何文件。" }

    $portal = Read-Host "配置站地址（直接回车使用 $DefaultPortal）"
    if ([string]::IsNullOrWhiteSpace($portal)) { $portal = $DefaultPortal }
    $portal = $portal.TrimEnd("/")
    $invite = Read-Host "队伍邀请码"
    $uploader = Read-Host "你的游戏昵称"
    $packageName = Read-Host "配置包名称（例如：大秘境治疗界面）"
    $note = Read-Host "备注（可直接回车跳过）"
    if ([string]::IsNullOrWhiteSpace($invite) -or [string]::IsNullOrWhiteSpace($uploader) -or [string]::IsNullOrWhiteSpace($packageName)) {
        Stop-WithMessage "邀请码、昵称和配置包名称不能为空。"
    }

    $work = Join-Path $env:TEMP ("WoWSync-" + [Guid]::NewGuid().ToString("N"))
    $payloadRetail = Join-Path $work "payload\_retail_"
    New-Item -ItemType Directory -Path $payloadRetail -Force | Out-Null

    Write-Host "`n正在复制配置，请稍候…" -ForegroundColor Cyan
    if (Test-Path $interface) {
        & robocopy $interface (Join-Path $payloadRetail "Interface") /E /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
        if ($LASTEXITCODE -gt 7) { throw "复制 Interface 失败，Robocopy 代码 $LASTEXITCODE" }
    }
    if (Test-Path $wtf) {
        & robocopy $wtf (Join-Path $payloadRetail "WTF") /E /XJ /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
        if ($LASTEXITCODE -gt 7) { throw "复制 WTF 失败，Robocopy 代码 $LASTEXITCODE" }
    }

    $manifest = @{
        formatVersion = 1
        gameVersion = "retail"
        createdAt = (Get-Date).ToUniversalTime().ToString("o")
        computer = $env:COMPUTERNAME
        includes = @("Interface", "WTF")
    } | ConvertTo-Json
    Set-Content -LiteralPath (Join-Path $work "payload\wowsync-manifest.json") -Value $manifest -Encoding UTF8

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = Join-Path $work "wow-config.zip"
    Write-Host "正在压缩完整配置…" -ForegroundColor Cyan
    [System.IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $work "payload"), $archive, [System.IO.Compression.CompressionLevel]::Optimal, $false)
    $file = Get-Item $archive
    if ($file.Length -gt 2GB) { throw "压缩包超过 2 GB，第一版暂不支持。请移除体积特别大的插件后重试。" }
    $sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $partCount = [Math]::Ceiling($file.Length / $PartSize)

    $headers = @{ "X-Invite-Code" = $invite }
    $body = @{
        name = $packageName
        uploader = $uploader
        note = $note
        sizeBytes = $file.Length
        totalParts = $partCount
        sha256 = $sha256
    } | ConvertTo-Json
    Write-Host "正在创建上传任务…" -ForegroundColor Cyan
    $created = Invoke-RestMethod -Uri "$portal/api/packages" -Method Post -Headers $headers -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))

    $source = [IO.File]::OpenRead($archive)
    try {
        for ($index = 0; $index -lt $partCount; $index++) {
            $remaining = $source.Length - $source.Position
            $length = [Math]::Min($PartSize, $remaining)
            $partPath = Join-Path $work ("part-{0:D3}.bin" -f $index)
            $target = [IO.File]::Create($partPath)
            try {
                $buffer = [byte[]]::new(1MB)
                $written = 0L
                while ($written -lt $length) {
                    $wanted = [int][Math]::Min($buffer.Length, $length - $written)
                    $read = $source.Read($buffer, 0, $wanted)
                    if ($read -le 0) { break }
                    $target.Write($buffer, 0, $read)
                    $written += $read
                }
            } finally { $target.Dispose() }
            $percent = [Math]::Round((($index + 1) / $partCount) * 100)
            Write-Host "上传分片 $($index + 1)/$partCount（$percent%）…" -ForegroundColor Cyan
            Invoke-RestMethod -Uri "$portal/api/packages/$($created.id)/parts/$index" -Method Put -Headers $headers -ContentType "application/octet-stream" -InFile $partPath | Out-Null
            Remove-Item -LiteralPath $partPath -Force
        }
    } finally { $source.Dispose() }

    Invoke-RestMethod -Uri "$portal/api/packages/$($created.id)/complete" -Method Post -Headers $headers | Out-Null
    Write-Host "`n上传完成！" -ForegroundColor Green
    Write-Host "配置包编号：$($created.id)" -ForegroundColor Yellow
    Write-Host "SHA-256：$sha256"
} catch {
    Write-Host "`n上传失败：$($_.Exception.Message)" -ForegroundColor Red
} finally {
    if ($work -and (Test-Path $work)) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    Read-Host "`n按回车键退出"
}
