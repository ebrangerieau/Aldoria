#!/usr/bin/env bash
# Tests du jeu (GUT) qui échouent aussi quand un fichier de test n'a pas tourné.
# GUT ignore sans échouer un fichier qui ne compile pas (« cannot infer the type »…) : on compare le nombre
# de scripts exécutés au nombre de fichiers test_*.gd, et on refuse toute erreur GUT (signal surveillé hors test…).
# Usage : tools/gut.sh [options GUT] ; GODOT=<chemin de godot> (par défaut : godot dans le PATH).
set -o pipefail
cd "$(dirname "$0")/.." || exit 1
godot=${GODOT:-godot}
log=$(mktemp)
timeout 600 "$godot" --headless --path game -s addons/gut/gut_cmdln.gd -gexit "$@" 2>&1 | tee "$log"
status=$?
clean=$(sed 's/\x1b\[[0-9;]*m//g' "$log")
rm -f "$log"
problems=()
[ "$status" -ne 0 ] && problems+=("GUT a terminé en erreur ($status)")
while IFS= read -r line; do problems+=("$line"); done < <(printf '%s\n' "$clean" | grep -E 'Failed to load script|Ignoring script' | sort -u)
errors=$(printf '%s\n' "$clean" | awk '$1 == "Errors" {print $2}' | tail -1)
[ -n "$errors" ] && [ "$errors" != "0" ] && problems+=("$errors erreur(s) GUT hors assertions (voir [GUT ERROR] plus haut)")
if [[ " $* " != *" -gselect"* && " $* " != *" -gtest"* && " $* " != *" -gunit_test_name"* ]]; then
	expected=$(find game/tests -name 'test_*.gd' | wc -l)
	ran=$(printf '%s\n' "$clean" | awk '$1 == "Scripts" {print $2}' | tail -1)
	[ "$ran" != "$expected" ] && problems+=("$ran script(s) de test exécuté(s) sur $expected fichiers test_*.gd")
fi
if [ ${#problems[@]} -gt 0 ]; then
	printf '\nÉCHEC des tests du jeu :\n' >&2
	printf '  - %s\n' "${problems[@]}" >&2
	exit 1
fi
echo "OK : $expected fichiers de test, tous exécutés."
