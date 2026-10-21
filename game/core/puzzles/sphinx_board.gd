class_name SphinxBoard
extends RefCounted
## Énigme de blocs du temple du Sphinx (type Sokoban), règles seules (la 3D : SphinxTemple). Le
## héros avance d'une dalle ; un bloc devant lui avance aussi si la dalle suivante est libre. On ne
## tire jamais un bloc. L'énigme est résolue quand chaque dalle gravée porte un bloc. Annuler revient
## d'un pas ; recommencer remet la salle comme au départ. Niveaux : SphinxLevels.

const DIRS := {"l": Vector2i(-1, 0), "r": Vector2i(1, 0), "u": Vector2i(0, -1), "d": Vector2i(0, 1)}

var width := 0
var height := 0
var walls: Array[Vector2i] = []
var sand: Array[Vector2i] = []  # hors du temple
var tiles := {}  # dalles du temple (Vector2i → true)
var goals: Array[Vector2i] = []
## Position de chaque bloc ; l'indice ne change jamais (un nœud 3D par bloc).
var boxes: Array[Vector2i] = []
var player := Vector2i.ZERO
var moves := 0
var pushes := 0
var _start_boxes: Array[Vector2i] = []
var _start_player := Vector2i.ZERO
var _history: Array[Dictionary] = []  # {dir, box} : bloc poussé (-1 : aucun)


static func from_rows(rows: Array) -> SphinxBoard:
	var board := SphinxBoard.new()
	board.height = rows.size()
	for y in rows.size():
		var line := str(rows[y])
		board.width = maxi(board.width, line.length())
		for x in line.length():
			var cell := Vector2i(x, y)
			match line[x]:
				"#":
					board.walls.append(cell)
				"~":
					board.sand.append(cell)
				_:
					board.tiles[cell] = true
					if line[x] in [".", "*", "+"]:
						board.goals.append(cell)
					if line[x] in ["$", "*"]:
						board.boxes.append(cell)
					if line[x] in ["@", "+"]:
						board.player = cell
	board._start_boxes = board.boxes.duplicate()
	board._start_player = board.player
	return board


func is_solved() -> bool:
	for g in goals:
		if box_at(g) < 0:
			return false
	return true


func box_at(cell: Vector2i) -> int:
	return boxes.find(cell)


func is_free(cell: Vector2i) -> bool:
	return tiles.has(cell) and box_at(cell) < 0


## Un pas dans une direction. Rend {"moved", "box"} : `box` est l'indice du bloc poussé (-1 sinon).
func step(dir: Vector2i) -> Dictionary:
	var to := player + dir
	if not tiles.has(to):
		return {"moved": false, "box": -1}
	var box := box_at(to)
	if box >= 0:
		if not is_free(to + dir):
			return {"moved": false, "box": -1}
		boxes[box] = to + dir
		pushes += 1
	player = to
	moves += 1
	_history.append({"dir": dir, "box": box})
	return {"moved": true, "box": box}


## Revient d'un pas (le bloc poussé recule avec le héros). Rend {"undone", "dir", "box"}.
func undo() -> Dictionary:
	if _history.is_empty():
		return {"undone": false, "dir": Vector2i.ZERO, "box": -1}
	var last: Dictionary = _history.pop_back()
	var dir: Vector2i = last["dir"]
	var box := int(last["box"])
	if box >= 0:
		boxes[box] = player
		pushes -= 1
	player -= dir
	moves -= 1
	return {"undone": true, "dir": dir, "box": box}


func can_undo() -> bool:
	return not _history.is_empty()


func restart() -> void:
	boxes = _start_boxes.duplicate()
	player = _start_player
	moves = 0
	pushes = 0
	_history.clear()


## Pas à faire pour marcher jusqu'à une dalle sans pousser de bloc (vide : déjà là ou impossible).
func path_to(cell: Vector2i) -> Array[Vector2i]:
	var path: Array[Vector2i] = []
	if cell == player or not is_free(cell):
		return path
	var prev := {player: player}
	var todo: Array[Vector2i] = [player]
	while not todo.is_empty():
		var cur: Vector2i = todo.pop_front()
		for d: Vector2i in DIRS.values():
			var n: Vector2i = cur + d
			if prev.has(n) or not is_free(n):
				continue
			prev[n] = cur
			if n == cell:
				var at := n
				while at != player:
					var before: Vector2i = prev[at]
					path.push_front(at - before)
					at = before
				return path
			todo.append(n)
	return path


## Un bloc hors d'une dalle gravée, coincé dans un coin : il ne bougera plus (annuler ou recommencer).
func stuck_box() -> int:
	for i in boxes.size():
		var b := boxes[i]
		if b in goals:
			continue
		var left := not tiles.has(b + Vector2i.LEFT)
		var right := not tiles.has(b + Vector2i.RIGHT)
		var up := not tiles.has(b + Vector2i.UP)
		var down := not tiles.has(b + Vector2i.DOWN)
		if (left or right) and (up or down):
			return i
	return -1


## Rejoue une suite de pas (lettres l r u d, majuscules ou minuscules) ; faux si un pas est impossible.
func play(solution: String) -> bool:
	for c in solution:
		if not step(DIRS[c.to_lower()])["moved"]:
			return false
	return true
