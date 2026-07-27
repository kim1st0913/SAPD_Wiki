param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[0-9a-f]{40}$")]
  [string]$SourceSha,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[a-z0-9][a-z0-9._-]{2,79}$")]
  [string]$DeliveryReleaseId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[0-9]+\.[0-9]+\.[0-9]+$")]
  [string]$AppVersion,

  [string]$OutputDir = "dist\windows-installer-evidence"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

if (-not $IsWindows) {
  throw "Windows installer verification must run on Windows."
}

function Get-LowerSha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ($Actual -ne $Expected) {
    throw "$Message (actual=$Actual expected=$Expected)"
  }
}

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) {
    throw $Message
  }
}

$ElectronRoot = Join-Path $RepoRoot "apps\electron"
$RuntimeTemplate = Join-Path $ElectronRoot ".build\runtime-template"
$InstallerPath = Join-Path $ElectronRoot "dist\SAPD-Wiki-Setup-$AppVersion-win-x64.exe"
$UnpackedRoot = Join-Path $ElectronRoot "dist\win-unpacked"
$PackageJsonPath = Join-Path $ElectronRoot "package.json"

Assert-True (Test-Path -LiteralPath $InstallerPath -PathType Leaf) "Final Setup.exe is missing."
Assert-True (Test-Path -LiteralPath $RuntimeTemplate -PathType Container) "Runtime template is missing."
Assert-True (Test-Path -LiteralPath $UnpackedRoot -PathType Container) "win-unpacked output is missing."

$Header = [System.IO.File]::ReadAllBytes($InstallerPath)[0..1]
Assert-True ($Header[0] -eq 0x4d -and $Header[1] -eq 0x5a) "Setup.exe is not a PE executable."

$PackageJson = Get-Content -LiteralPath $PackageJsonPath -Raw | ConvertFrom-Json
Assert-Equal ([string]$PackageJson.version) $AppVersion "Electron version mismatch."
Assert-True ($PackageJson.build.nsis.perMachine -eq $false) "Installer must be per-user."
Assert-True ($PackageJson.build.nsis.allowElevation -eq $false) "Installer elevation must be disabled."
Assert-True ($PackageJson.build.nsis.deleteAppDataOnUninstall -eq $false) "Uninstall must preserve user data."

$RuntimeMetadataPath = Join-Path $RuntimeTemplate "electron-runtime-build.json"
$RuntimeMetadata = Get-Content -LiteralPath $RuntimeMetadataPath -Raw | ConvertFrom-Json
Assert-Equal ([string]$RuntimeMetadata.schemaVersion) "sapd-windows-electron-runtime-v2" "Runtime metadata schema mismatch."
Assert-Equal ([string]$RuntimeMetadata.sourceRevision) $SourceSha "Runtime source SHA mismatch."
Assert-Equal ([string]$RuntimeMetadata.deliveryData.releaseId) $DeliveryReleaseId "Runtime Delivery Data mismatch."
Assert-Equal ([string]$RuntimeMetadata.platform) "win-x64" "Runtime platform mismatch."
Assert-True ([string]$RuntimeMetadata.runtimeFingerprint -match "^[0-9a-f]{64}$") "Runtime fingerprint is invalid."

$AppConfigPath = Join-Path $RuntimeTemplate "config\app-config.json"
$AppConfig = Get-Content -LiteralPath $AppConfigPath -Raw | ConvertFrom-Json
Assert-True ($AppConfig.mcp_platform_integration -eq $true) "Windows package must include MCP platform integration."

$DeliveryManifestPath = Join-Path $RuntimeTemplate "data\base\windows-delivery-data-manifest.json"
$DeliveryManifest = Get-Content -LiteralPath $DeliveryManifestPath -Raw | ConvertFrom-Json
Assert-Equal ([string]$DeliveryManifest.releaseId) $DeliveryReleaseId "Embedded Delivery Data release mismatch."
Assert-True ($DeliveryManifest.approvedForWindowsPackaging -eq $true) "Embedded Delivery Data is not approved."
Assert-Equal ([string]$DeliveryManifest.databases.user.status) "not_included" "Real user data must not be packaged."

$BaseDb = Join-Path $RuntimeTemplate "data\base\sapd_wiki_base.sqlite3"
$AssetDb = Join-Path $RuntimeTemplate "data\base\sapd_content_assets.sqlite3"
$UserDb = Join-Path $RuntimeTemplate "data\user\sapd_wiki_user.sqlite3"
Assert-Equal (Get-LowerSha256 $BaseDb) ([string]$DeliveryManifest.databases.base.sha256) "Base database hash mismatch."
Assert-Equal (Get-LowerSha256 $AssetDb) ([string]$DeliveryManifest.databases.contentAssets.sha256) "Content asset database hash mismatch."
Assert-True (Test-Path -LiteralPath $UserDb -PathType Leaf) "Empty user database template is missing."

foreach ($RequiredPath in @(
  "SAPD-Wiki-Backend.exe",
  "_internal",
  "app\frontend-dist\index.html",
  "config\app-config.json",
  "data\base\base-manifest.json",
  ".sapd-runtime-fingerprint"
)) {
  Assert-True (Test-Path -LiteralPath (Join-Path $RuntimeTemplate $RequiredPath)) "Runtime member is missing: $RequiredPath"
}

foreach ($RequiredPath in @(
  "SAPD Wiki.exe",
  "resources\app.asar",
  "resources\runtime-template\SAPD-Wiki-Backend.exe",
  "resources\runtime-template\data\base\sapd_wiki_base.sqlite3",
  "resources\runtime-template\data\base\sapd_content_assets.sqlite3"
)) {
  Assert-True (Test-Path -LiteralPath (Join-Path $UnpackedRoot $RequiredPath)) "win-unpacked member is missing: $RequiredPath"
}

$EvidenceRoot = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot $OutputDir))
New-Item -ItemType Directory -Force -Path $EvidenceRoot | Out-Null
$RunnerRoot = Join-Path $env:RUNNER_TEMP "sapd-wiki-windows-runner-uat"
$InstallRoot = Join-Path $RunnerRoot "install"
$LocalAppDataRoot = Join-Path $RunnerRoot "local-app-data"
$DataParent = Join-Path $RunnerRoot "app-data"
$DataRoot = Join-Path $DataParent "SAPDWiki"
$SettingsRoot = Join-Path $LocalAppDataRoot "SAPD Wiki"
$SettingsPath = Join-Path $SettingsRoot "settings.json"

if (Test-Path -LiteralPath $RunnerRoot) {
  Remove-Item -LiteralPath $RunnerRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $SettingsRoot, $DataRoot | Out-Null
$Settings = [ordered]@{
  dataRoot = $DataRoot
  importDirectory = (Join-Path $DataRoot "import")
  downloadDirectory = (Join-Path $DataRoot "export")
}
$Settings | ConvertTo-Json | Set-Content -LiteralPath $SettingsPath -Encoding utf8

$InstallResult = Start-Process -FilePath $InstallerPath `
  -ArgumentList @("/S", "/D=$InstallRoot") `
  -Wait `
  -PassThru
Assert-Equal $InstallResult.ExitCode 0 "Silent NSIS installation failed."
$InstalledExe = Join-Path $InstallRoot "SAPD Wiki.exe"
$Uninstaller = Join-Path $InstallRoot "Uninstall SAPD Wiki.exe"
Assert-True (Test-Path -LiteralPath $InstalledExe -PathType Leaf) "Installed application is missing."
Assert-True (Test-Path -LiteralPath $Uninstaller -PathType Leaf) "NSIS uninstaller is missing."

$ProcessInfo = [System.Diagnostics.ProcessStartInfo]::new()
$ProcessInfo.FileName = $InstalledExe
$ProcessInfo.UseShellExecute = $false
$ProcessInfo.Environment["LOCALAPPDATA"] = $LocalAppDataRoot
$AppProcess = [System.Diagnostics.Process]::Start($ProcessInfo)
$RuntimeStatePath = Join-Path $DataRoot "Runtime\logs\runtime-state.json"
$Health = $null
$McpPanel = $null
$Deadline = [DateTime]::UtcNow.AddSeconds(45)
try {
  while ([DateTime]::UtcNow -lt $Deadline) {
    if ($AppProcess.HasExited) {
      throw "Installed application exited before the backend became ready."
    }
    if (Test-Path -LiteralPath $RuntimeStatePath -PathType Leaf) {
      try {
        $RuntimeState = Get-Content -LiteralPath $RuntimeStatePath -Raw | ConvertFrom-Json
        if ($RuntimeState.url) {
          $Health = Invoke-RestMethod -Uri "$($RuntimeState.url.TrimEnd('/'))/api/v1/health" -TimeoutSec 2
          if ($Health.ok -eq $true) {
            $SessionToken = [string]$Health.data.auth.session_token
            if ($SessionToken) {
              $McpPanel = Invoke-RestMethod `
                -Uri "$($RuntimeState.url.TrimEnd('/'))/api/v1/mcp/control-panel" `
                -Headers @{ "X-SAPD-Session-Token" = $SessionToken } `
                -TimeoutSec 2
              if ($McpPanel.contract_version -eq "sapd-mcp-control-v1") {
                break
              }
            }
          }
        }
      } catch {
        $Health = $null
      }
    }
    Start-Sleep -Milliseconds 500
  }
  Assert-True ($null -ne $Health -and $Health.ok -eq $true) "Installed application backend did not become healthy."
  Assert-Equal ([string]$Health.data.status) "ok" "Installed runtime health status mismatch."
  Assert-True ([string]$Health.data.runtime.runtime_id -match "^[A-Za-z0-9._:-]{8,128}$") "Installed MCP runtime identity is missing."
  Assert-True ($null -ne $McpPanel) "Installed MCP control plane is unreachable."
  Assert-Equal ([string]$McpPanel.data.certificate.trust_backend) "windows_current_user_root" "Installed MCP trust backend mismatch."
  Assert-Equal ([string]$McpPanel.data.certificate.secret_backend) "windows_dpapi_current_user" "Installed MCP secret backend mismatch."
  Assert-True (
    @("not_configured", "valid", "expiring", "renewal_required") -contains [string]$McpPanel.data.certificate.state
  ) "Installed MCP certificate state is invalid."
} finally {
  if ($null -ne $AppProcess -and -not $AppProcess.HasExited) {
    & taskkill.exe /pid $AppProcess.Id /t /f | Out-Null
  }
}

$UserDataProbe = Join-Path $DataRoot "runner-user-data-preservation-probe.txt"
"preserve" | Set-Content -LiteralPath $UserDataProbe -Encoding ascii
$UninstallResult = Start-Process -FilePath $Uninstaller -ArgumentList @("/S") -Wait -PassThru
Assert-Equal $UninstallResult.ExitCode 0 "Silent NSIS uninstall failed."
Assert-True (-not (Test-Path -LiteralPath $InstalledExe)) "Installed executable remains after uninstall."
Assert-True (Test-Path -LiteralPath $UserDataProbe -PathType Leaf) "Uninstall deleted user data."

$InstallerHash = Get-LowerSha256 $InstallerPath
$BuildInfo = [ordered]@{
  schemaVersion = "sapd-windows-installer-build-v1"
  sourceSha = $SourceSha
  sourceRevision = $SourceSha
  deliveryReleaseId = $DeliveryReleaseId
  deliverySourceSha = [string]$RuntimeMetadata.deliveryData.sourceMainRevision
  appVersion = $AppVersion
  platform = "win-x64"
  runtimeFingerprint = [string]$RuntimeMetadata.runtimeFingerprint
  backendSha256 = [string]$RuntimeMetadata.backend.backendSha256
  baseSha256 = [string]$DeliveryManifest.databases.base.sha256
  contentAssetsSha256 = [string]$DeliveryManifest.databases.contentAssets.sha256
  installerFileName = [System.IO.Path]::GetFileName($InstallerPath)
  installerBytes = (Get-Item -LiteralPath $InstallerPath).Length
  installerSha256 = $InstallerHash
  signingStatus = "unsigned"
  builtAtUtc = [DateTime]::UtcNow.ToString("o")
}
$BuildInfoPath = Join-Path $EvidenceRoot "windows-installer-build-info.json"
$BuildInfo | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $BuildInfoPath -Encoding utf8
"$InstallerHash *$([System.IO.Path]::GetFileName($InstallerPath))" |
  Set-Content -LiteralPath (Join-Path $EvidenceRoot "SHA256SUMS.txt") -Encoding ascii

$RunnerUat = [ordered]@{
  schemaVersion = "sapd-windows-runner-uat-v1"
  status = "passed"
  sourceSha = $SourceSha
  deliveryReleaseId = $DeliveryReleaseId
  mcpPlatformIntegration = $true
  runnerImage = [string]$env:ImageOS
  operatingSystem = [System.Environment]::OSVersion.VersionString
  checks = [ordered]@{
    installerPe = $true
    runtimeHashes = $true
    mcpPlatformIntegrationRequired = $true
    silentInstall = $true
    installedBackendHealth = $true
    mcpControlPlaneReachable = $true
    mcpDpapiCurrentUser = $true
    mcpCurrentUserRoot = $true
    silentUninstall = $true
    userDataPreserved = $true
  }
  realWindows10And11UatStillRequired = $true
  completedAtUtc = [DateTime]::UtcNow.ToString("o")
}
$RunnerUat | ConvertTo-Json -Depth 8 |
  Set-Content -LiteralPath (Join-Path $EvidenceRoot "windows-runner-uat.json") -Encoding utf8

Write-Host "Windows installer verification passed."
Write-Host "installer_sha256=$InstallerHash"
Write-Host "evidence_root=$EvidenceRoot"
