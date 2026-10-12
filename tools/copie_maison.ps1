# Copie des sauvegardes de la base hors du VPS, sur un ordinateur de la maison.
# Récupère les sauvegardes quotidiennes absentes du dossier local, vérifie chacune
# (gzip complet, fin de pg_dump, empreinte SHA-256 confirmée par le serveur), puis garde les
# -Garder plus récentes. Le serveur note la copie : l'espace parent affiche sa date.
#
# La clé SSH dédiée ne peut que lister, envoyer et confirmer (deploy/backup/copie-maison.sh,
# commande forcée dans authorized_keys) : elle n'ouvre pas de terminal sur le serveur.
#
# Usage : powershell -File tools/copie_maison.ps1 [-Destination <dossier>] [-Cle <clé privée>]
# Planification (tâche Windows quotidienne, rattrapée si l'ordinateur était éteint) :
#   powershell -File tools/copie_maison.ps1 -Planifier
param(
    [string]$Destination = (Join-Path $env:USERPROFILE 'Documents\Sauvegardes Aldoria'),
    [string]$Cle = (Join-Path $env:USERPROFILE '.ssh\aldoria_copie'),
    [string]$Serveur = 'root@72.60.188.128',
    [int]$Garder = 60,
    [switch]$Planifier
)

if ($Planifier) {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument (
        "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$PSCommandPath`" " +
        "-Destination `"$Destination`" -Cle `"$Cle`" -Serveur $Serveur -Garder $Garder")
    $declencheur = New-ScheduledTaskTrigger -Daily -At '19:00'
    $options = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
    Register-ScheduledTask -TaskName 'Aldoria - copie des sauvegardes' -Action $action -Trigger $declencheur `
        -Settings $options -Description 'Copie à la maison des sauvegardes de la base des Chroniques d''Aldoria' -Force | Out-Null
    Write-Host 'Tâche planifiée « Aldoria - copie des sauvegardes » : tous les jours à 19 h (ou dès que possible).'
    return
}

New-Item -ItemType Directory -Force $Destination | Out-Null
$journal = Join-Path $Destination 'journal.txt'
function Noter([string]$texte) {
    $ligne = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $texte
    Add-Content -Path $journal -Value $ligne -Encoding UTF8
    Write-Host $ligne
}
$ssh = @('-i', $Cle, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=20', $Serveur)

# Vérifie qu'un fichier est un gzip complet qui se termine comme un pg_dump réussi.
function Est-Complete([string]$chemin) {
    $flux = $null
    try {
        $flux = New-Object System.IO.Compression.GZipStream ([System.IO.File]::OpenRead($chemin)), ([System.IO.Compression.CompressionMode]::Decompress)
        $lecteur = New-Object System.IO.StreamReader $flux
        $texte = $lecteur.ReadToEnd()
        return $texte.Contains('-- PostgreSQL database dump complete')
    } catch {
        return $false
    } finally {
        if ($flux) { $flux.Dispose() }
    }
}

$liste = & ssh @ssh 'liste' 2>&1
if ($LASTEXITCODE -ne 0) { Noter "ÉCHEC : serveur injoignable ou clé refusée ($liste)"; exit 1 }
$noms = @($liste | Where-Object { $_ -match '^aldoria-\d{8}T\d{6}Z\.sql\.gz$' })
$nouveaux = @($noms | Where-Object { -not (Test-Path (Join-Path $Destination $_)) })
$echecs = 0
$derniere = $null
foreach ($nom in $nouveaux) {
    $cible = Join-Path $Destination $nom
    $partiel = "$cible.partiel"
    # Start-Process écrit la sortie octet par octet (une redirection PowerShell l'abîmerait).
    $arguments = "-i `"$Cle`" -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20 $Serveur envoyer $nom"
    $p = Start-Process ssh -ArgumentList $arguments -NoNewWindow -Wait -PassThru `
        -RedirectStandardOutput $partiel -RedirectStandardError "$partiel.err"
    $erreur = Get-Content "$partiel.err" -Raw -ErrorAction SilentlyContinue
    Remove-Item "$partiel.err" -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0 -or -not (Est-Complete $partiel)) {
        Remove-Item $partiel -ErrorAction SilentlyContinue
        Noter "ÉCHEC : $nom incomplète ($erreur)"
        $echecs++
        continue
    }
    $empreinte = (Get-FileHash $partiel -Algorithm SHA256).Hash.ToLower()
    $reponse = & ssh @ssh "confirmer $nom $empreinte" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Remove-Item $partiel -ErrorAction SilentlyContinue
        Noter "ÉCHEC : $nom différente de celle du serveur ($reponse)"
        $echecs++
        continue
    }
    Move-Item $partiel $cible -Force
    $derniere = $nom
    Noter "copiée : $nom ($((Get-Item $cible).Length) octets)"
}

# Les plus récentes d'abord (le nom contient la date) ; au-delà de -Garder, on efface.
Get-ChildItem $Destination -Filter 'aldoria-*.sql.gz' | Sort-Object Name -Descending |
    Select-Object -Skip $Garder | ForEach-Object { Remove-Item $_.FullName; Noter "effacée (ancienne) : $($_.Name)" }

if ($nouveaux.Count -eq 0 -and $noms.Count -gt 0) {
    # Rien de nouveau : on confirme quand même la plus récente, pour dater la copie côté serveur.
    $recente = ($noms | Sort-Object -Descending)[0]
    $empreinte = (Get-FileHash (Join-Path $Destination $recente) -Algorithm SHA256).Hash.ToLower()
    & ssh @ssh "confirmer $recente $empreinte" 2>&1 | Out-Null
    Noter "à jour : $recente déjà copiée"
}
if ($echecs -gt 0) { exit 1 }
if ($derniere) { Noter "OK : $($nouveaux.Count) sauvegarde(s) copiée(s) dans $Destination" }
