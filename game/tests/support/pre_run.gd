extends GutHookScript
## Avant toute la suite de tests : aménagements d'accessibilité par défaut. Les tests
## partagent le dossier user:// du jeu, où une partie lancée sur ce PC (avec des
## aménagements) a pu laisser sa connexion et ses préférences.


func run() -> void:
	Accessibility.prefs = {}
	Accessibility.apply_parent(Accessibility.DEFAULTS)
	Accessibility._apply()
