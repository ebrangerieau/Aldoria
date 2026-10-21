extends GutTest
## Énigmes de blocs du temple du Sphinx : règles (pousser, jamais tirer, annuler, recommencer,
## marcher jusqu'à une dalle) et niveaux générés (tools/make_sphinx_levels.py) qui se résolvent tous.

const ROWS := [
	"######",
	"#@ $.#",
	"#    #",
	"######",
]


func test_push_and_solve() -> void:
	var board := SphinxBoard.from_rows(ROWS)
	assert_eq(board.player, Vector2i(1, 1))
	assert_eq(board.boxes, [Vector2i(3, 1)] as Array[Vector2i])
	assert_eq(board.goals, [Vector2i(4, 1)] as Array[Vector2i])
	assert_false(board.is_solved())
	assert_eq(board.step(Vector2i.RIGHT), {"moved": true, "box": -1})
	assert_eq(board.step(Vector2i.RIGHT), {"moved": true, "box": 0}, "le bloc avance avec le héros")
	assert_true(board.is_solved())
	assert_eq([board.moves, board.pushes], [2, 1])


func test_blocked_moves() -> void:
	var board := SphinxBoard.from_rows(ROWS)
	assert_false(board.step(Vector2i.LEFT)["moved"], "un mur")
	assert_false(board.step(Vector2i.UP)["moved"])
	board.play("rr")  # bloc sur la dalle, contre le mur
	assert_false(board.step(Vector2i.RIGHT)["moved"], "un bloc contre un mur ne bouge pas")
	assert_eq(board.moves, 2)


func test_undo_and_restart() -> void:
	var board := SphinxBoard.from_rows(ROWS)
	board.play("rr")
	var back := board.undo()
	assert_true(back["undone"])
	assert_eq(int(back["box"]), 0, "le bloc recule avec le héros")
	assert_eq(board.boxes[0], Vector2i(3, 1))
	assert_eq(board.player, Vector2i(2, 1))
	assert_eq([board.moves, board.pushes], [1, 0])
	board.play("d")
	board.restart()
	assert_eq(board.player, Vector2i(1, 1))
	assert_false(board.can_undo())


func test_walk_to_a_tile() -> void:
	var board := SphinxBoard.from_rows(ROWS)
	assert_eq(board.path_to(Vector2i(4, 2)).size(), 4, "par en dessous du bloc, sans le pousser")
	assert_true(board.path_to(Vector2i(3, 1)).is_empty(), "jamais sur un bloc")
	assert_true(board.path_to(Vector2i(0, 0)).is_empty(), "jamais dans un mur")


func test_stuck_box_in_a_corner() -> void:
	var board := SphinxBoard.from_rows(["#####", "#  .#", "# $ #", "#@  #", "#####"])
	assert_eq(board.stuck_box(), -1)
	board.play("ur")
	assert_eq(board.boxes[0], Vector2i(3, 2))
	assert_eq(board.stuck_box(), -1, "contre un seul mur, il peut encore glisser")
	board.play("urd")
	assert_eq(board.boxes[0], Vector2i(3, 3))
	assert_eq(board.stuck_box(), 0, "dans un coin, hors d'une dalle gravée : coincé")


func test_every_level_has_a_working_solution() -> void:
	assert_eq(SphinxLevels.TIERS.size(), SphinxIsland.tier_count())
	var count := 0
	for tier: Array in SphinxLevels.TIERS:
		assert_gt(tier.size(), 9, "assez d'énigmes par palier")
		for level: Dictionary in tier:
			var board := SphinxBoard.from_rows(level["rows"])
			assert_eq(board.boxes.size(), board.goals.size())
			assert_gt(board.boxes.size(), 0)
			assert_false(board.is_solved(), "rien n'est en place au départ")
			var solution := str(level["solution"])
			assert_true(board.play(solution), "chaque pas de la solution est possible")
			assert_true(board.is_solved(), "la solution range tous les blocs")
			assert_eq(board.pushes, int(level["pushes"]))
			count += 1
	gut.p("%d énigmes rejouées" % count)


func test_tiers_get_harder() -> void:
	var before := 0.0
	for tier: Array in SphinxLevels.TIERS:
		var total := 0
		for level: Dictionary in tier:
			total += int(level["pushes"])
		var mean := float(total) / tier.size()
		assert_gt(mean, before)
		before = mean
