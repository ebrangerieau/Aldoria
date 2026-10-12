extends GutTest
## Personnalisation (Wardrobe) : apparence par défaut, choix verrouillés, habillage
## d'un modèle KayKit, renard du monde de Jules et sauvegarde de l'apparence.


func before_each() -> void:
	SaveManager._profile_id = 0
	SaveManager.data = SaveManager.default_data()
	Session.profile = {}


func after_each() -> void:
	SaveManager.data = SaveManager.default_data()
	Session.profile = {}


func test_default_look_matches_each_world() -> void:
	var jules := Wardrobe.default_look("jules")
	assert_eq(jules["model"], "Knight")
	assert_eq(jules["main"], "1H_Sword")
	assert_eq(jules["off"], "Round_Shield")
	assert_eq(jules["pet_fur"], "roux")
	assert_eq(Wardrobe.default_look("tom")["model"], "Rogue_Hooded")


func test_sanitize_rejects_unknown_and_locked_choices() -> void:
	var look := Wardrobe.sanitize({"model": "Dragon", "main": "Bazooka"}, "jules", 1, 0)
	assert_eq(look["model"], "Knight")
	assert_eq(look["main"], "1H_Sword")
	# Mage : niveau 5 ; cape or : trois donjons ; pelage arctique : un donjon.
	var wanted := {"model": "Mage", "cape_color": "or", "pet_fur": "arctique", "pet_name": "Inconnu"}
	look = Wardrobe.sanitize(wanted, "jules", 1, 0)
	assert_eq(look["model"], "Knight")
	assert_eq(look["cape_color"], "origine")
	assert_eq(look["pet_fur"], "roux")
	assert_eq(look["pet_name"], "Roux")
	look = Wardrobe.sanitize(wanted, "jules", 5, 3)
	assert_eq(look["model"], "Mage")
	assert_eq(look["main"], "1H_Wand", "une nouvelle silhouette prend ses pièces par défaut")
	assert_eq(look["cape_color"], "or")
	assert_eq(look["pet_fur"], "arctique")
	assert_eq(Wardrobe.sanitize("pas un dictionnaire", "tom", 1, 0)["model"], "Rogue_Hooded")


func test_two_handed_weapon_frees_nothing_else() -> void:
	var look := Wardrobe.sanitize({"model": "Knight", "main": "2H_Sword", "off": "Spike_Shield"}, "jules", 1, 0)
	assert_eq(look["off"], "")
	assert_eq(Wardrobe.attacks_for(look)[0], "2H_Melee_Attack_Chop")
	# Le voleur n'a pas de couvre-chef.
	assert_false(Wardrobe.sanitize({"model": "Rogue", "head": true}, "tom", 2, 0)["head"])


func test_attack_follows_weapon() -> void:
	assert_eq(Wardrobe.attacks_for({"main": "1H_Wand"})[0], "Spellcast_Shoot")
	assert_eq(Wardrobe.attacks_for({"main": "1H_Crossbow"})[0], "1H_Ranged_Shoot")
	assert_eq(Wardrobe.attacks_for({"main": "Knife", "off": "Knife_Offhand"})[0], "Dualwield_Melee_Attack_Chop")
	assert_eq(Wardrobe.attacks_for({"main": "Mug"})[0], "Unarmed_Melee_Attack_Punch_A")


func test_unlocks_are_announced_once() -> void:
	var names := Wardrobe.newly_unlocked(Vector2i(1, 0), Vector2i(3, 1), true)
	assert_has(names, "Silhouette : voleur")
	assert_has(names, "Silhouette : barbare")
	assert_has(names, "Cape : vert forêt")
	assert_has(names, "Pelage : arctique")
	assert_does_not_have(names, "Silhouette : mage")
	assert_eq(Wardrobe.newly_unlocked(Vector2i(3, 1), Vector2i(3, 1), true).size(), 0)
	assert_false(Wardrobe.newly_unlocked(Vector2i(1, 0), Vector2i(1, 1), false).has("Pelage : arctique"), "pas de pelage sans compagnon")
	assert_gt(Wardrobe.unlocked_count(5, 3, true), Wardrobe.unlocked_count(1, 0, true))


func test_dress_shows_one_weapon_per_hand_and_paints_the_cape() -> void:
	var look := Wardrobe.sanitize({"model": "Knight", "main": "2H_Sword", "head": false, "cape_color": "rouge"}, "jules", 1, 0)
	var fighter := Fighter.create_hero(look, "Test", 100)
	add_child_autofree(fighter)
	var shown := {}
	for node in fighter.find_children("*", "MeshInstance3D", true, false):
		shown[String(node.name)] = (node as MeshInstance3D).visible
	assert_true(shown["2H_Sword"])
	assert_false(shown["1H_Sword"])
	for shield in ["Round_Shield", "Badge_Shield", "Rectangle_Shield", "Spike_Shield", "1H_Sword_Offhand"]:
		assert_false(shown[shield], shield)
	assert_false(shown["Knight_Helmet"])
	assert_true(shown["Knight_Cape"])
	var cape := fighter.find_child("Knight_Cape", true, false) as MeshInstance3D
	var mat := cape.get_surface_override_material(0) as BaseMaterial3D
	assert_eq(mat.albedo_color, Color("#d64545"))
	assert_null(mat.albedo_texture)
	assert_eq(fighter.attack_animations[0], "2H_Melee_Attack_Chop")


func test_villagers_hold_a_single_weapon_too() -> void:
	var body := Fighter.instantiate_model("Barbarian")
	add_child_autofree(body)
	var visible_weapons := 0
	for part in ["1H_Axe", "2H_Axe", "Mug", "1H_Axe_Offhand"]:
		if (body.find_child(part, true, false) as MeshInstance3D).visible:
			visible_weapons += 1
	assert_eq(visible_weapons, 1)


func test_companion_follows_on_the_heros_footsteps() -> void:
	var hero := Node3D.new()
	add_child_autofree(hero)
	var pet := Companion.create(Wardrobe.sanitize({"pet_fur": "sable"}, "jules", 1, 0))
	add_child_autofree(pet)
	pet.follow(hero)
	var start := pet.position
	assert_almost_eq(start.distance_to(hero.position), 1.36, 0.05)
	# Le héros longe un couloir en L : le renard passe par le coin, pas en diagonale.
	for i in 40:
		hero.position = Vector3(minf(i * 0.25, 5.0), 0, maxf(0.0, (i - 20) * 0.25))
		pet._physics_process(1.0 / 30.0)
	for i in 90:
		pet._physics_process(1.0 / 30.0)
	assert_gt(pet.position.distance_to(hero.position), 1.0, "il garde ses distances")
	assert_lt(pet.position.distance_to(hero.position), Companion.FOLLOW_GAP + 0.5, "il a rattrapé le héros")
	# Héros téléporté (reprise d'une salle) : le renard le rejoint aussitôt.
	hero.position = Vector3(40, 0, 0)
	pet._physics_process(1.0 / 30.0)
	assert_lt(pet.position.distance_to(hero.position), 2.0)


func test_companion_fur_is_painted() -> void:
	var pet := Companion.create(Wardrobe.sanitize({"pet_fur": "sable"}, "jules", 1, 0))
	add_child_autofree(pet)
	var colors: Array[Color] = []
	for node in pet.find_children("*", "MeshInstance3D", true, false):
		var mesh_instance := node as MeshInstance3D
		for surface in mesh_instance.mesh.get_surface_count():
			var mat := mesh_instance.get_surface_override_material(surface) as BaseMaterial3D
			if mat:
				colors.append(mat.albedo_color)
	assert_has(colors, Wardrobe.fur("sable")["main"])
	assert_has(colors, Wardrobe.fur("sable")["light"])


func test_look_is_saved_and_rechecked() -> void:
	Session.profile = {"world": "jules"}
	assert_eq(SaveManager.look()["model"], "Knight", "partie sans apparence : celle par défaut")
	SaveManager.set_look({"model": "Rogue_Hooded", "main": "1H_Crossbow", "cape_color": "or"})
	assert_eq(SaveManager.data["look"]["main"], "1H_Crossbow")
	assert_eq(SaveManager.data["look"]["cape_color"], "origine", "couleur pas encore débloquée")
	# Une sauvegarde d'un autre appareil au contenu invalide reste jouable.
	SaveManager.data["look"] = {"model": 42}
	assert_eq(SaveManager.look()["model"], "Knight")


func _button(screen: Node, text: String) -> Button:
	for node in screen.find_children("*", "Button", true, false):
		if (node as Button).text == text:
			return node
	return null


func test_screen_buttons_change_the_look() -> void:
	Session.profile = {"world": "jules"}
	var screen: Control = (load("res://scenes/wardrobe/wardrobe.tscn") as PackedScene).instantiate()
	add_child_autofree(screen)
	_button(screen, "Grande épée").pressed.emit()
	await get_tree().process_frame
	assert_eq(screen._look["main"], "2H_Sword")
	assert_eq(screen._look["off"], "", "deux mains : plus de bouclier")
	assert_not_null(_button(screen, "Voleur · Niveau 2"), "silhouette verrouillée, avec sa condition")
	assert_true(_button(screen, "Voleur · Niveau 2").disabled)
	_button(screen, "Noisette").pressed.emit()
	await get_tree().process_frame
	assert_eq(screen._look["pet_name"], "Noisette")
	# Sans écran (tests headless), le moteur de rendu factice ne connaît pas les matériaux
	# de l'aperçu 3D : erreurs propres à ce mode, absentes sur PC et dans le navigateur.
	for error in get_errors():
		if "material" in str(error.code):
			error.handled = true
