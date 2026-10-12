# Test de restauration d'une sauvegarde de la base (fichier aldoria-*.sql.gz) :
# la charge dans un PostgreSQL 16 jetable (Docker) et affiche la version du schéma et le
# nombre de lignes des tables principales. Rien n'est écrit ailleurs ; le conteneur est supprimé.
#
# Usage : powershell -File tools/test_restauration.ps1 <fichier.sql.gz>
param([Parameter(Mandatory = $true)][string]$Fichier)

# Codes de retour vérifiés un par un (Windows PowerShell traite la sortie d'erreur de docker comme une exception).
$Fichier = (Resolve-Path $Fichier).Path
$nom = 'aldoria-restauration-test'
docker rm -f $nom 2>&1 | Out-Null
docker run -d --name $nom -e POSTGRES_PASSWORD=restauration -e POSTGRES_USER=aldoria -e POSTGRES_DB=aldoria postgres:16-alpine | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Docker indisponible" }
try {
    $pret = $false
    for ($i = 0; $i -lt 30 -and -not $pret; $i++) {
        Start-Sleep 1
        docker exec $nom pg_isready -U aldoria -d aldoria *> $null
        $pret = $LASTEXITCODE -eq 0
    }
    if (-not $pret) { throw 'PostgreSQL jetable non démarré' }
    Start-Sleep 2 # pg_isready répond avant la fin du script d'initialisation de l'image
    docker cp $Fichier "${nom}:/tmp/sauvegarde.sql.gz"
    docker exec $nom sh -c 'gunzip -c /tmp/sauvegarde.sql.gz | psql -q -v ON_ERROR_STOP=1 -U aldoria -d aldoria' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'la restauration a échoué' }
    $requete = @"
select 'schéma (alembic)', version_num from alembic_version
union all select 'profils', count(*)::text from profile
union all select 'réponses', count(*)::text from attempt
union all select 'sessions', count(*)::text from game_session
union all select 'sauvegardes de partie', count(*)::text from save_revision
union all select 'questions de la banque', count(*)::text from bank_item
union all select 'notions', count(*)::text from notion;
"@
    docker exec $nom psql -U aldoria -d aldoria -At -F ' : ' -c $requete
    if ($LASTEXITCODE -ne 0) { throw 'lecture de la base restaurée impossible' }
    Write-Host "OK : $(Split-Path $Fichier -Leaf) se restaure."
}
finally {
    docker rm -f $nom | Out-Null
}
