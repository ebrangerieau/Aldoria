class_name SphinxTemple
extends Node3D
## Temple du Sphinx en 3D pour une énigme de blocs (SphinxBoard) : dalles de grès sur le sable,
## murs à chaperon, dalles gravées, blocs à pousser, le grand Sphinx couché au nord, pyramides et
## palmiers. Décor tiré de formes simples (aucun pack de plus), couleurs par sommet : tout le décor
## fixe tient en un seul maillage (budget tablette). Une dalle gravée s'allume quand un bloc la
## couvre ; les yeux du Sphinx brillent quand l'énigme est résolue.

const TILE := 2.0
const FLOOR_H := 0.35
const BLOCK := Vector3(1.68, 1.3, 1.68)

var board: SphinxBoard
var _wt: WorldTheme
var _palette: Dictionary
var _boxes: Array[MeshInstance3D] = []
var _goals: Array[MeshInstance3D] = []
var _eyes: Array[MeshInstance3D] = []
var _block_mat: StandardMaterial3D
var _block_lit: StandardMaterial3D
var _glyph_mat: StandardMaterial3D
var _glyph_lit: StandardMaterial3D
var _eye_lit: StandardMaterial3D


## Couleurs selon le monde : plein soleil (lumineux) ou crépuscule (brouillard).
static func palette(world: String) -> Dictionary:
	if world == "brouillard":
		return {"sand": Color("#9a9198"), "dune": Color("#8a808c"), "tile": Color("#b3a99e"), "tile2": Color("#a59b91"),
			"wall": Color("#6c6670"), "cap": Color("#827c86"), "block": Color("#a07050"), "block_top": Color("#4a6c94"),
			"stone": Color("#a69a8c"), "stone_dark": Color("#7c7068"), "nemes": Color("#465f80"), "nemes2": Color("#c4a866"),
			"glyph": Color("#3f6690"), "glow": Color("#9fdcff"), "palm": Color("#4c6a58"), "trunk": Color("#665448"),
			"sky": Color("#262a45"), "ambient": Color(0.62, 0.64, 0.8), "sun": Color(0.78, 0.82, 1.0), "sun_energy": 0.55}
	return {"sand": Color("#e8d9b5"), "dune": Color("#dccaa0"), "tile": Color("#ead8b0"), "tile2": Color("#dfca9e"),
		"wall": Color("#a69886"), "cap": Color("#bfb19c"), "block": Color("#c98352"), "block_top": Color("#3a6aa0"),
		"stone": Color("#dcc59c"), "stone_dark": Color("#b5a07c"), "nemes": Color("#3a68a4"), "nemes2": Color("#e3c063"),
		"glyph": Color("#3a6aa0"), "glow": Color("#ffd447"), "palm": Color("#5e9a55"), "trunk": Color("#8c6c4c"),
		"sky": Color("#9fd2ea"), "ambient": Color(0.92, 0.9, 0.86), "sun": Color(1.0, 0.96, 0.88), "sun_energy": 0.5}


func setup(puzzle: SphinxBoard, wt: WorldTheme) -> void:
	board = puzzle
	_wt = wt
	_palette = palette(wt.id)
	_make_materials()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	_build_ground(st)
	_build_floor(st)
	_build_walls(st)
	_build_sphinx(st)
	_build_scenery(st)
	var decor := MeshInstance3D.new()
	decor.name = "Decor"
	decor.mesh = st.commit()
	decor.material_override = _static_material()
	add_child(decor)
	_build_goals()
	_build_boxes()
	refresh_marks()


## Centre d'une dalle, au niveau du sol du temple.
func cell_position(cell: Vector2i) -> Vector3:
	return Vector3((cell.x - (board.width - 1) / 2.0) * TILE, 0.0, (cell.y - (board.height - 1) / 2.0) * TILE)


## Taille du temple en mètres (largeur, profondeur), pour cadrer la caméra.
func footprint() -> Vector2:
	return Vector2(board.width * TILE, board.height * TILE)


func box_node(index: int) -> MeshInstance3D:
	return _boxes[index]


## Dalles gravées couvertes et blocs en place : allumés.
func refresh_marks() -> void:
	for i in board.goals.size():
		_goals[i].material_override = _glyph_lit if board.box_at(board.goals[i]) >= 0 else _glyph_mat
	for i in board.boxes.size():
		_boxes[i].material_override = _block_lit if board.boxes[i] in board.goals else _block_mat


## Remet chaque bloc sur sa dalle (après « recommencer » ou une aide du Sphinx).
func place_boxes() -> void:
	for i in board.boxes.size():
		_boxes[i].position = cell_position(board.boxes[i])
	refresh_marks()


func goal_points() -> Array[Vector3]:
	var points: Array[Vector3] = []
	for g in board.goals:
		points.append(cell_position(g) + Vector3(0, BLOCK.y, 0))
	return points


## Les yeux du Sphinx s'allument : l'énigme est résolue.
func celebrate() -> void:
	for eye in _eyes:
		eye.material_override = _eye_lit


func sphinx_head() -> Vector3:
	return _sphinx_origin() + Vector3(0, 4.6, 2.2)


# --- Matériaux -------------------------------------------------------------------------------

func _static_material() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = false
	m.roughness = 0.95
	if Quality.settings().vertex_shading:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	return m


func _make_materials() -> void:
	_block_mat = _static_material()
	_block_lit = _static_material()
	_block_lit.emission_enabled = true
	_block_lit.emission = (_palette["glow"] as Color).darkened(0.35)
	_block_lit.emission_energy_multiplier = 0.45
	_glyph_mat = StandardMaterial3D.new()
	_glyph_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_glyph_mat.albedo_color = _palette["glyph"]
	_glyph_lit = StandardMaterial3D.new()
	_glyph_lit.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_glyph_lit.albedo_color = _palette["glow"]
	_eye_lit = StandardMaterial3D.new()
	_eye_lit.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_eye_lit.albedo_color = _palette["glow"]


# --- Décor fixe ------------------------------------------------------------------------------

func _build_ground(st: SurfaceTool) -> void:
	_box(st, Transform3D(Basis(), Vector3(0, -FLOOR_H - 0.05, -10)), Vector3(140, 0.1, 110), _palette["sand"])
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	var half := footprint() / 2.0
	for i in 26:  # dunes basses autour du temple
		var at := Vector3(rng.randf_range(-34, 34), -FLOOR_H, rng.randf_range(-40, 18))
		if absf(at.x) < half.x + 3.0 and at.z > -half.y - 3.0 and at.z < half.y + 3.0:
			continue
		var size := Vector3(rng.randf_range(4, 9), rng.randf_range(0.3, 0.9), rng.randf_range(2.5, 5))
		_box(st, Transform3D(Basis(Vector3.UP, rng.randf_range(-0.6, 0.6)), at + Vector3(0, size.y / 2.0 - 0.2, 0)), size, _palette["dune"])


func _build_floor(st: SurfaceTool) -> void:
	for cell: Vector2i in board.tiles:
		var color: Color = _palette["tile"] if (cell.x + cell.y) % 2 == 0 else _palette["tile2"]
		_box(st, Transform3D(Basis(), cell_position(cell) + Vector3(0, -FLOOR_H / 2.0, 0)), Vector3(TILE - 0.06, FLOOR_H, TILE - 0.06), color)
		_box(st, Transform3D(Basis(), cell_position(cell) + Vector3(0, -FLOOR_H - 0.02, 0)), Vector3(TILE, 0.06, TILE), _palette["stone_dark"])


func _build_walls(st: SurfaceTool) -> void:
	for cell in board.walls:
		# Mur devant une dalle (côté caméra) : bas, pour ne pas cacher le jeu.
		var low := board.tiles.has(cell + Vector2i.UP) and not board.tiles.has(cell + Vector2i.DOWN)
		var h := 0.45 if low else 0.95
		var at := cell_position(cell)
		_box(st, Transform3D(Basis(), at + Vector3(0, (h - FLOOR_H) / 2.0, 0)), Vector3(TILE, h + FLOOR_H, TILE), _palette["wall"])
		_box(st, Transform3D(Basis(), at + Vector3(0, h + 0.09, 0)), Vector3(TILE + 0.14, 0.18, TILE + 0.14), _palette["cap"])


func _sphinx_origin() -> Vector3:
	return Vector3(0, -FLOOR_H, -footprint().y / 2.0 - 5.6)


## Le Sphinx couché, tourné vers le temple ; ses yeux s'allument à la fin d'une énigme.
func _build_sphinx(st: SurfaceTool) -> void:
	var o := _sphinx_origin()
	sphinx_shape(st, o, 1.0, _palette)
	var head := o + Vector3(0, 4.6, 1.5)
	var eye_mat := StandardMaterial3D.new()
	eye_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	eye_mat.albedo_color = Color("#2a2018")
	for side in [-1.0, 1.0]:
		var eye := MeshInstance3D.new()
		var mesh := BoxMesh.new()
		mesh.size = Vector3(0.42, 0.18, 0.1)
		eye.mesh = mesh
		eye.material_override = eye_mat
		eye.position = head + Vector3(side * 0.42, 0.28, 1.02)
		add_child(eye)
		_eyes.append(eye)


## Sphinx couché (socle, corps, pattes, poitrail, tête, némès rayé), tourné vers +z, à l'échelle `k`.
static func sphinx_shape(st: SurfaceTool, o: Vector3, k: float, colors: Dictionary) -> void:
	var stone: Color = colors["stone"]
	var dark: Color = colors["stone_dark"]
	var part := func(center: Vector3, size: Vector3, color: Color) -> void:
		_box(st, Transform3D(Basis(), o + center * k), size * k, color)
	part.call(Vector3(0, 0.4, 0), Vector3(7.6, 0.8, 9.0), dark)  # socle
	part.call(Vector3(0, 1.9, -1.4), Vector3(4.0, 2.2, 5.4), stone)  # corps
	part.call(Vector3(0, 2.4, -3.6), Vector3(4.4, 2.6, 1.8), stone)  # croupe
	for side in [-1.0, 1.0]:
		part.call(Vector3(side * 1.25, 1.2, 2.4), Vector3(1.1, 0.8, 3.6), stone)  # pattes avant
		part.call(Vector3(side * 1.25, 1.1, 4.25), Vector3(1.2, 0.6, 0.35), dark)  # griffes
	part.call(Vector3(0, 2.7, 1.2), Vector3(3.2, 2.6, 1.6), stone)  # poitrail
	var head := Vector3(0, 4.6, 1.5)
	# Némès : coiffe rayée qui encadre le visage et retombe sur les épaules.
	part.call(head + Vector3(0, 0.2, -0.35), Vector3(2.7, 2.3, 1.7), colors["nemes"])
	for i in 3:
		part.call(head + Vector3(0, 1.0 - i * 0.62, -0.32), Vector3(2.76, 0.16, 1.74), colors["nemes2"])
	for side in [-1.0, 1.0]:
		part.call(head + Vector3(side * 1.05, -1.25, 0.15), Vector3(0.7, 1.6, 0.7), colors["nemes"])
		part.call(head + Vector3(side * 1.05, -1.25, 0.15), Vector3(0.74, 0.16, 0.74), colors["nemes2"])
	part.call(head + Vector3(0, 0.0, 0.55), Vector3(1.7, 1.9, 0.9), stone)  # visage
	part.call(head + Vector3(0, -0.25, 1.05), Vector3(0.32, 0.5, 0.25), dark)  # nez
	part.call(head + Vector3(0, -1.2, 0.85), Vector3(0.35, 0.6, 0.3), colors["nemes2"])  # barbe
	part.call(head + Vector3(0, 1.45, 0.35), Vector3(0.5, 0.5, 0.5), colors["nemes2"])  # cobra


## L'île sur la carte du royaume : une pyramide et le Sphinx, à la taille d'une tuile.
static func map_piece(world: String) -> MeshInstance3D:
	var colors := palette(world)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	pyramid_shape(st, Vector3(-0.3, 0, -0.4), 1.9, 1.5, colors)
	sphinx_shape(st, Vector3(0.55, 0, 0.45), 0.16, colors)
	var node := MeshInstance3D.new()
	node.mesh = st.commit()
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = false
	m.roughness = 0.95
	node.material_override = m
	return node


func _build_scenery(st: SurfaceTool) -> void:
	var half := footprint() / 2.0
	pyramid_shape(st, Vector3(-17, -FLOOR_H, -half.y - 16), 15.0, 10.0, _palette)
	pyramid_shape(st, Vector3(16, -FLOOR_H, -half.y - 22), 19.0, 13.0, _palette)
	pyramid_shape(st, Vector3(-4, -FLOOR_H, -half.y - 30), 11.0, 7.5, _palette)
	for spot in [Vector3(-half.x - 3.2, 0, -half.y + 1.0), Vector3(half.x + 3.0, 0, -half.y + 2.5),
			Vector3(-half.x - 4.5, 0, half.y - 2.0), Vector3(half.x + 4.2, 0, half.y - 4.0),
			Vector3(-7.5, 0, -half.y - 6.0), Vector3(7.8, 0, -half.y - 5.0)]:
		_palm(st, spot + Vector3(0, -FLOOR_H, 0), spot.x * 0.13)
	# Obélisques de part et d'autre du Sphinx.
	for side in [-1.0, 1.0]:
		var at := _sphinx_origin() + Vector3(side * 5.2, 0, 2.6)
		_box(st, Transform3D(Basis(), at + Vector3(0, 0.3, 0)), Vector3(1.4, 0.6, 1.4), _palette["stone_dark"])
		_box(st, Transform3D(Basis(), at + Vector3(0, 3.0, 0)), Vector3(0.8, 4.8, 0.8), _palette["stone"])
		_box(st, Transform3D(Basis(Vector3.UP, PI / 4.0), at + Vector3(0, 5.6, 0)), Vector3(0.5, 0.5, 0.5), _palette["nemes2"])


static func pyramid_shape(st: SurfaceTool, base: Vector3, width: float, height: float, colors: Dictionary) -> void:
	var h := width / 2.0
	var apex := base + Vector3(0, height, 0)
	var corners := [base + Vector3(-h, 0, -h), base + Vector3(h, 0, -h), base + Vector3(h, 0, h), base + Vector3(-h, 0, h)]
	var inside := base + Vector3(0, height * 0.3, 0)
	for i in 4:
		var shade: Color = (colors["stone"] as Color).darkened(0.12 * (i % 2))
		_tri(st, corners[i], corners[(i + 1) % 4], apex, shade, inside)
	_box(st, Transform3D(Basis(), apex + Vector3(0, -height * 0.06, 0)), Vector3(width * 0.12, height * 0.12, width * 0.12), colors["nemes2"])


func _palm(st: SurfaceTool, base: Vector3, lean: float) -> void:
	var at := base
	var tilt := Vector3(clampf(lean, -0.35, 0.35), 1.0, 0.08).normalized()
	for i in 6:  # tronc en anneaux, légèrement penché
		var basis := Basis(Vector3.UP.cross(tilt).normalized() if absf(tilt.x) > 0.01 else Vector3.RIGHT, Vector3.UP.angle_to(tilt))
		_box(st, Transform3D(basis, at + tilt * 0.45), Vector3(0.42 - i * 0.03, 0.85, 0.42 - i * 0.03), _palette["trunk"] if i % 2 == 0 else (_palette["trunk"] as Color).lightened(0.12))
		at += tilt * 0.82
	for k in 7:  # palmes retombantes
		var yaw := TAU * k / 7.0
		var dir := Vector3(sin(yaw), 0, cos(yaw))
		var basis := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, 0.45)
		_box(st, Transform3D(basis, at + dir * 1.1 + Vector3(0, -0.15, 0)), Vector3(0.7, 0.08, 2.4), _palette["palm"] if k % 2 == 0 else (_palette["palm"] as Color).darkened(0.15))


# --- Éléments mobiles ------------------------------------------------------------------------

func _build_goals() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c := Color.WHITE
	var inside := Vector3(0, -1, 0)
	# Cadre carré et œil en losange gravés dans la dalle (dessus seulement).
	for side in 4:
		var basis := Basis(Vector3.UP, side * PI / 2.0)
		_flat(st, basis, Vector3(-0.72, 0, -0.72), Vector3(0.72, 0, -0.56), c, inside)
	_tri(st, Vector3(-0.42, 0, 0), Vector3(0, 0, -0.26), Vector3(0.42, 0, 0), c, inside)
	_tri(st, Vector3(-0.42, 0, 0), Vector3(0.42, 0, 0), Vector3(0, 0, 0.26), c, inside)
	var mesh := st.commit()
	for g in board.goals:
		var node := MeshInstance3D.new()
		node.mesh = mesh
		node.position = cell_position(g) + Vector3(0, 0.012, 0)
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(node)
		_goals.append(node)


func _build_boxes() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var main: Color = _palette["block"]
	var top: Color = _palette["block_top"]
	_box(st, Transform3D(Basis(), Vector3(0, BLOCK.y / 2.0, 0)), BLOCK, main)
	_box(st, Transform3D(Basis(), Vector3(0, BLOCK.y * 0.72, 0)), Vector3(BLOCK.x + 0.04, 0.14, BLOCK.z + 0.04), top)  # bandeau
	_box(st, Transform3D(Basis(), Vector3(0, BLOCK.y + 0.02, 0)), Vector3(0.8, 0.06, 0.8), top)  # œil gravé
	_box(st, Transform3D(Basis(), Vector3(0, BLOCK.y + 0.05, 0)), Vector3(0.32, 0.04, 0.32), main.lightened(0.2))
	var mesh := st.commit()
	for b in board.boxes:
		var node := MeshInstance3D.new()
		node.mesh = mesh
		node.position = cell_position(b)
		add_child(node)
		_boxes.append(node)


# --- Formes ------------------------------------------------------------------------------------

## Pavé (transform : centre et orientation), faces plates.
static func _box(st: SurfaceTool, xf: Transform3D, size: Vector3, color: Color) -> void:
	var h := size / 2.0
	var p: Array[Vector3] = []
	for i in 8:
		p.append(xf * Vector3(h.x if i & 1 else -h.x, h.y if i & 2 else -h.y, h.z if i & 4 else -h.z))
	var inside := xf.origin
	for face in [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]:
		_tri(st, p[face[0]], p[face[1]], p[face[2]], color, inside)
		_tri(st, p[face[0]], p[face[2]], p[face[3]], color, inside)


## Rectangle à plat (y = 0) de `a` à `b`, tourné par `basis`.
static func _flat(st: SurfaceTool, basis: Basis, a: Vector3, b: Vector3, color: Color, inside: Vector3) -> void:
	var p0 := basis * a
	var p1 := basis * Vector3(b.x, 0, a.z)
	var p2 := basis * b
	var p3 := basis * Vector3(a.x, 0, b.z)
	_tri(st, p0, p1, p2, color, inside)
	_tri(st, p0, p2, p3, color, inside)


## Triangle tourné vers l'extérieur (à l'opposé de `inside`), avec sa normale.
static func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, color: Color, inside: Vector3) -> void:
	var n := (b - a).cross(c - a)
	if n.length_squared() < 1e-10:
		return
	if n.dot(a - inside) < 0.0:
		var t := b
		b = c
		c = t
		n = -n
	# Godot affiche la face avant dans le sens des aiguilles d'une montre : a, c, b.
	n = n.normalized()
	var lin := color.srgb_to_linear()  # couleurs du jeu en sRGB, éclairage en linéaire
	st.set_color(lin)
	st.set_normal(n)
	st.add_vertex(a)
	st.set_color(lin)
	st.set_normal(n)
	st.add_vertex(c)
	st.set_color(lin)
	st.set_normal(n)
	st.add_vertex(b)
