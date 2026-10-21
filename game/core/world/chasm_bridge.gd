class_name ChasmBridge
extends Node3D
## Pont des fractions de Jules : un gouffre du nord au sud (DungeonRoom.chasm), deux avancées de
## roche dont l'écart vaut la largeur du ravin (énigme `visual.kind = "pont"`, générateur
## 6e.fractions.pont), le tas des planches choisies sur la rive ouest, puis le pont posé bout à
## bout. Le pont tient si la somme des planches vaut exactement l'écart (fractions exactes,
## jamais de flottants) ; trop court ou trop long, les planches tombent dans le gouffre.
## Une perche mesure PERCHE mètres ; chaque dénominateur a sa couleur (comme des réglettes).

const PERCHE := 5.5
const HALF := 6.0  # demi-largeur du gouffre
const DEPTH := 9.0
const BRIDGE_W := 1.8
const THICK := 0.2
const PILE := Vector3(-8.6, 0, -2.4)  # centre du tas, planches rangées du nord au sud
const LAY_SECONDS := 0.3
const COLORS := {
	1: Color("#a8703f"), 2: Color("#e09f3e"), 3: Color("#6a994e"), 4: Color("#4d96c9"),
	5: Color("#9d6bc2"), 6: Color("#d1495b"), 8: Color("#f7a1c4"), 10: Color("#2a9d8f"),
}

var gap := Vector2i(1, 1)
var _wt: WorldTheme
var _settings: Dictionary
var _round: Node3D
var _pile: Array[MeshInstance3D] = []
var _laid: Array[MeshInstance3D] = []
var _materials := {}


func _ready() -> void:
	_settings = Quality.settings()
	_build_chasm()


# --- Fractions exactes : Vector2i(numérateur, dénominateur), toujours réduites. ---

static func parse(text: String) -> Vector2i:
	var parts := text.strip_edges().split("/")
	var den := int(parts[1]) if parts.size() > 1 else 1
	return reduce(Vector2i(int(parts[0]), den))


static func reduce(f: Vector2i) -> Vector2i:
	var a := absi(f.x)
	var b := absi(f.y)
	while b != 0:
		var t := a % b
		a = b
		b = t
	return Vector2i(f.x / a, f.y / a) if a > 1 else f


static func add(a: Vector2i, b: Vector2i) -> Vector2i:
	return reduce(Vector2i(a.x * b.y + b.x * a.y, a.y * b.y))


## Somme d'une liste de longueurs écrites (« 1/2 », « 1 »).
static func total(lengths: Array) -> Vector2i:
	var sum := Vector2i(0, 1)
	for length: String in lengths:
		sum = add(sum, parse(length))
	return sum


## Signe de a − b.
static func compare(a: Vector2i, b: Vector2i) -> int:
	return signi(a.x * b.y - b.x * a.y)


static func write(f: Vector2i) -> String:
	return str(f.x) if f.y == 1 else "%d/%d" % [f.x, f.y]


static func meters(f: Vector2i) -> float:
	return PERCHE * f.x / f.y


## Une façon de couvrir `target` avec la réserve [{length, count}] (développement, captures) ;
## [] s'il n'y en a pas.
static func solve(stock: Array, target: Vector2i, from := 0) -> Array:
	if target.x == 0:
		return []
	for i in range(from, stock.size()):
		var length := str(stock[i]["length"])
		var rest := add(target, Vector2i(-parse(length).x, parse(length).y))
		if rest.x < 0 or int(stock[i]["count"]) <= 0:
			continue
		var left: Array = stock.duplicate(true)
		left[i]["count"] = int(left[i]["count"]) - 1
		var tail := solve(left, rest, i)
		if rest.x == 0 or not tail.is_empty():
			return [length] + tail
	return []


static func color_for(length: String) -> Color:
	return COLORS.get(parse(length).y, Color("#8d6e63"))


# --- Décor fixe : parois et fond du gouffre. ---

func _build_chasm() -> void:
	var rock := Color("#4a4038")
	var deep := Color("#07080c")
	var mesh := ArrayMesh.new()
	var verts := PackedVector3Array()
	var colors := PackedColorArray()
	var z0 := -10.0
	var z1 := 20.0
	# Parois est et ouest (face tournée vers le gouffre), puis la paroi du fond, sous le mur nord.
	for side in [-1.0, 1.0]:
		var x: float = side * HALF
		var quad := [Vector3(x, 0, z0), Vector3(x, 0, z1), Vector3(x, -DEPTH, z1), Vector3(x, -DEPTH, z0)]
		_quad(verts, colors, quad, rock, deep)
	_quad(verts, colors, [Vector3(HALF, 0, z0), Vector3(-HALF, 0, z0), Vector3(-HALF, -DEPTH, z0), Vector3(HALF, -DEPTH, z0)], rock, deep)
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = verts
	arrays[Mesh.ARRAY_COLOR] = colors
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var walls := MeshInstance3D.new()
	walls.mesh = mesh
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	walls.material_override = m
	add_child(walls)
	# Fond : une rivière sombre, tout en bas.
	var river := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(HALF * 2.0, z1 - z0)
	river.mesh = plane
	river.position = Vector3(0, -DEPTH, (z0 + z1) / 2.0)
	var water := StandardMaterial3D.new()
	water.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	water.albedo_color = Color("#081620")
	river.material_override = water
	add_child(river)


## Quadrilatère dégradé : haut en `top`, bas en `bottom` (sommets dans l'ordre du tour).
static func _quad(verts: PackedVector3Array, colors: PackedColorArray, q: Array, top: Color, bottom: Color) -> void:
	for i in [0, 1, 2, 0, 2, 3]:
		var v: Vector3 = q[i]
		verts.append(v)
		colors.append(top if v.y > -0.5 else bottom)


func _lit(color: Color) -> StandardMaterial3D:
	if _materials.has(color):
		return _materials[color]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.85
	if _settings.get("vertex_shading", false):
		m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	_materials[color] = m
	return m


# --- Une manche : les deux avancées, la mesure du ravin, le tas vide. ---

func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	if _round != null:
		_round.queue_free()
	_pile.clear()
	_laid.clear()
	_round = Node3D.new()
	add_child(_round)
	gap = parse(str(visual.get("gap", "1")))
	var tip := gap_meters() / 2.0
	for side in [-1.0, 1.0]:
		var ledge := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(HALF - tip + 0.02, 0.7, BRIDGE_W + 0.8)
		ledge.mesh = box
		ledge.material_override = _lit(Color("#6b5f55"))
		ledge.position = Vector3(side * (tip + HALF) / 2.0, -0.35, 0)
		_round.add_child(ledge)
	# Cote du ravin, comme sur un plan : un trait doré d'une rive à l'autre et sa longueur.
	var ink := StandardMaterial3D.new()
	ink.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ink.albedo_color = Color("#ffd447")
	var z := -BRIDGE_W / 2.0 - 0.7
	for part in [[Vector3(0, 0.6, z), Vector3(tip * 2.0, 0.07, 0.07)],
			[Vector3(-tip, 0.6, z), Vector3(0.07, 0.5, 0.07)], [Vector3(tip, 0.6, z), Vector3(0.07, 0.5, 0.07)]]:
		var bar := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = part[1]
		bar.mesh = b
		bar.material_override = ink
		bar.position = part[0]
		_round.add_child(bar)
	var label := Label3D.new()
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font = Accessibility.font()
	label.font_size = 64
	label.pixel_size = 0.012
	label.outline_size = 16
	label.outline_modulate = Color(0, 0, 0, 0.8)
	label.modulate = Color("#ffd447")
	label.text = _measure_text()
	label.position = Vector3(0, 1.25, z)
	_round.add_child(label)


func _measure_text() -> String:
	if gap.y == 1:
		return "%d perche%s" % [gap.x, "s" if gap.x > 1 else ""]
	return "%s de perche" % write(gap)


func gap_meters() -> float:
	return meters(gap)


## Bord ouest du ravin (début du pont) et bord est (où le héros arrive).
func west_edge() -> Vector3:
	return Vector3(-gap_meters() / 2.0, 0, 0)


func east_edge() -> Vector3:
	return Vector3(gap_meters() / 2.0, 0, 0)


## Le tas sur la rive ouest reflète le choix en cours (dans l'ordre de pose).
func set_pile(lengths: Array) -> void:
	for p in _pile:
		p.queue_free()
	_pile.clear()
	for i in lengths.size():
		var plank := _plank(str(lengths[i]))
		plank.rotation.y = PI / 2.0  # rangée du nord au sud
		plank.position = PILE + Vector3(0, THICK * (i + 0.5), 0)
		_orient_label(plank)
		_round.add_child(plank)
		_pile.append(plank)


func pile_count() -> int:
	return _pile.size()


func _plank(length: String) -> MeshInstance3D:
	var size := meters(parse(length))
	var plank := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(size - 0.05, THICK, BRIDGE_W)
	plank.mesh = box
	plank.material_override = _lit(color_for(length))
	plank.set_meta("length", length)
	var label := Label3D.new()
	label.name = "Label"
	label.font = Accessibility.font()
	label.font_size = 64
	label.outline_size = 12
	label.outline_modulate = Color(0, 0, 0, 0.75)
	label.text = length
	# Le texte tient dans la planche (les huitièmes ne font qu'un demi-mètre).
	label.pixel_size = minf(0.009, (size - 0.15) / (length.length() * 64 * 0.62))
	label.position = Vector3(0, THICK / 2.0 + 0.01, 0)
	plank.add_child(label)
	return plank


## Texte posé à plat sur la planche, lisible de la caméra (vers le nord), quelle que soit
## l'orientation de la planche.
func _orient_label(plank: MeshInstance3D) -> void:
	var label := plank.get_node("Label") as Label3D
	label.basis = plank.basis.inverse() * Basis.from_euler(Vector3(-PI / 2.0, 0, 0))


## Pose les planches du tas bout à bout depuis la rive ouest. Renvoie « juste », « court » ou
## « long » (la dernière planche bute alors sur l'autre rive et se soulève).
func build() -> String:
	var lengths: Array = _pile.map(func(p: MeshInstance3D) -> String: return str(p.get_meta("length")))
	var outcome := compare(total(lengths), gap)
	var x := -gap_meters() / 2.0
	var edge := gap_meters() / 2.0
	for plank in _pile:
		var size := meters(parse(str(plank.get_meta("length"))))
		var goal := Transform3D(Basis.IDENTITY, Vector3(x + size / 2.0, -THICK / 2.0, 0))
		if x >= edge - 0.001:
			goal.origin.y = THICK / 2.0  # déjà sur l'autre rive : posée dessus
		elif x + size > edge + 0.001:
			# Elle déborde : son bout repose sur la roche d'en face, elle penche.
			var tilt := atan2(THICK, size)
			goal = Transform3D(Basis(Vector3(0, 0, 1), tilt), Vector3(x + size / 2.0, 0.0, 0))
		var tween := create_tween().set_parallel()
		tween.tween_property(plank, "transform", goal, LAY_SECONDS).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
		var label := plank.get_node("Label") as Label3D
		tween.tween_property(label, "basis", Basis.from_euler(Vector3(-PI / 2.0, 0, 0)), LAY_SECONDS)
		await tween.finished
		Sfx.play("hit", 0.5)
		_laid.append(plank)
		x += size
	_pile.clear()
	if outcome == 0:
		return "juste"
	return "court" if outcome < 0 else "long"


## Le pont mal ajusté s'effondre : les planches tombent dans le gouffre en tournoyant.
func collapse() -> void:
	if _laid.is_empty():
		return
	await get_tree().create_timer(0.35).timeout
	var tween := create_tween().set_parallel()
	for i in _laid.size():
		var plank := _laid[i]
		var delay := 0.08 * i
		tween.tween_property(plank, "position:y", -DEPTH + 0.5, 1.1).set_delay(delay).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tween.tween_property(plank, "rotation:z", randf_range(-1.2, 1.2), 1.1).set_delay(delay)
	await tween.finished
	for plank in _laid:
		plank.queue_free()
	_laid.clear()


## Points des joints du pont posé (étincelles quand il tient).
func joints() -> Array[Vector3]:
	var points: Array[Vector3] = []
	for plank in _laid:
		points.append(plank.position + Vector3(0, THICK, 0))
	return points
