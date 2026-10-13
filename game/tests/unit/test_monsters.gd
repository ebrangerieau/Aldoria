extends GutTest
## Monstres Quaternius : chacun a ses animations de repos, d'attaque, de coup reçu et de
## mort (noms KayKit traduits), et tous les ennemis du jeu existent.


func test_every_monster_animates_like_a_skeleton() -> void:
	for model in Fighter.MONSTERS:
		var f := Fighter.create(model, model, 10, "Idle_Combat")
		add_child_autofree(f)
		assert_ne(f.idle_animation, "", "%s : repos" % model)
		for group in ["Hit_A", "Death_A", "1H_Melee_Attack_Chop"]:
			assert_ne(f._monster_anim(group), "", "%s : %s" % [model, group])
		assert_gt(f.play(f.attack_animations), 0.0, "%s : attaque jouée" % model)
		assert_true(f._monster_anim("Death_A").contains("Death"), "%s : la mort reste figée" % model)


func test_all_enemies_have_a_model() -> void:
	var models: Array = []
	for level in ["6e", "2nde"]:
		for d in DungeonDef.all_for_level(level):
			for room in d.rooms:
				for e in room.get("enemies", []):
					models.append(e["model"])
	for world in ["lumineux", "brouillard"]:
		var wt := WorldTheme.for_world(world)
		assert_eq(wt.enemy_models.size(), wt.enemy_names.size(), world)
		models.append_array(wt.enemy_models)
	for model in models:
		assert_true(ResourceLoader.exists(Fighter.model_path(model)), model)
