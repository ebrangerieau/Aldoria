class_name LineRange
extends Node3D
## Stand de tir de Tom : un repère dressé comme un mur de tir (vue de côté), une arbalète sur
## l'axe des ordonnées en (0 ; b), une cible en (x ; y) (énigme `visual.kind = "repere_tir"`,
## générateur 2nde.droites.tir). Le carreau suit la droite y = a·x + b choisie par l'enfant :
## il se plante dans la cible, ou sort du repère en laissant sa trace.

const U := 0.85  # mètres par unité du repère
const BOTTOM := 0.5  # hauteur de l'axe des abscisses

var width := 10
var height := 8
var start := Vector2i(0, 0)
var target := Vector2i(5, 5)
var _drawing: Node3D
var _shots: Array[Node3D] = []
var _wt: WorldTheme


func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	if _drawing != null:
		_drawing.queue_free()
	for shot in _shots:
		shot.queue_free()
	_shots.clear()
	width = int(visual.get("width", 10))
	height = int(visual.get("height", 8))
	var s: Array = visual.get("start", [0, 0])
	var t: Array = visual.get("target", [5, 5])
	start = Vector2i(int(s[0]), int(s[1]))
	target = Vector2i(int(t[0]), int(t[1]))
	_drawing = Node3D.new()
	add_child(_drawing)
	_draw()


## Point du repère → position locale (sur le mur, légèrement devant).
func point(x: float, y: float, depth := 0.06) -> Vector3:
	return Vector3((x - width / 2.0) * U, BOTTOM + y * U, depth)


static func _unshaded(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	return m


func _draw() -> void:
	var board := MeshInstance3D.new()
	var quad := QuadMesh.new()
	quad.size = Vector2((width + 1.6) * U, (height + 1.4) * U)
	quad.material = _unshaded(Color("#1d2a36") if _wt.id == "brouillard" else Color("#3a2e22"))
	board.mesh = quad
	board.position = point(width / 2.0 - 0.3, height / 2.0 - 0.2, 0.0)
	_drawing.add_child(board)

	# Quadrillage (un seul lot), puis les axes, plus épais.
	var line := BoxMesh.new()
	line.size = Vector3.ONE
	line.material = _unshaded(Color(1, 1, 1, 1).darkened(0.55))
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = line
	mm.instance_count = (width + 1) + (height + 1)
	var n := 0
	for x in width + 1:
		mm.set_instance_transform(n, Transform3D(Basis.from_scale(Vector3(0.025, height * U, 0.01)), point(x, height / 2.0, 0.02)))
		n += 1
	for y in height + 1:
		mm.set_instance_transform(n, Transform3D(Basis.from_scale(Vector3(width * U, 0.025, 0.01)), point(width / 2.0, y, 0.02)))
		n += 1
	var grid := MultiMeshInstance3D.new()
	grid.multimesh = mm
	_drawing.add_child(grid)
	var ink := Color("#f2ead8")
	_segment(point(0, 0, 0.03), point(width + 0.4, 0, 0.03), 0.06, ink)
	_segment(point(0, 0, 0.03), point(0, height + 0.4, 0.03), 0.06, ink)
	for x in range(1, width + 1):
		_label(str(x), point(x, -0.45, 0.05), ink, 40)
	for y in range(0, height + 1):
		_label(str(y), point(-0.45, y, 0.05), ink, 40)
	_label("x", point(width + 0.6, 0, 0.05), ink, 44)
	_label("y", point(0, height + 0.6, 0.05), ink, 44)

	# Arbalète sur l'axe des ordonnées, cible au point visé (avec ses coordonnées).
	var bow := Node3D.new()
	var body := BoxMesh.new()
	body.size = Vector3(0.7, 0.14, 0.14)
	body.material = _unshaded(Color("#8a6236"))
	var b := MeshInstance3D.new()
	b.mesh = body
	b.position.x = -0.25
	bow.add_child(b)
	var arc := BoxMesh.new()
	arc.size = Vector3(0.08, 0.7, 0.1)
	arc.material = _unshaded(Color("#c9a04a"))
	var a := MeshInstance3D.new()
	a.mesh = arc
	bow.add_child(a)
	bow.position = point(start.x, start.y, 0.15)
	_drawing.add_child(bow)
	_label("(0 ; %d)" % start.y, point(start.x + 0.9, start.y + 0.55, 0.1), Color("#ffd27a"), 40)

	var t := ProtractorRange.make_target(_wt, 0.36)
	t.position = point(target.x, target.y, 0.1) - Vector3(0, ProtractorRange.TARGET_H, 0)
	for child in t.get_children():
		if child is MeshInstance3D and (child as MeshInstance3D).mesh is CylinderMesh and ((child as MeshInstance3D).mesh as CylinderMesh).height > 0.5:
			child.visible = false  # pas de pied : la cible est accrochée au mur
	_drawing.add_child(t)
	_label("(%d ; %d)" % [target.x, target.y], point(target.x, target.y + 0.8, 0.1), Color("#ffd27a"), 40)


func _segment(from: Vector3, to: Vector3, thickness: float, color: Color, parent: Node3D = null) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(from.distance_to(to), thickness, 0.02)
	mesh.material = _unshaded(color)
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = (from + to) / 2.0
	node.rotation.z = atan2(to.y - from.y, to.x - from.x)
	(parent if parent != null else _drawing).add_child(node)
	return node


func _label(text: String, at: Vector3, color: Color, size: int) -> void:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.008
	l.outline_size = 12
	l.modulate = color
	l.position = at
	_drawing.add_child(l)


## Hauteur du carreau à l'abscisse de la cible, en fraction (numérateur, dénominateur).
static func height_at(numerator: int, denominator: int, b: int, x: int) -> Vector2i:
	var top := numerator * x + b * denominator
	var bottom := denominator
	var g := _gcd(absi(top), absi(bottom))
	return Vector2i(top / g, bottom / g) if g > 0 else Vector2i(top, bottom)


static func _gcd(p: int, q: int) -> int:
	while q != 0:
		var r := p % q
		p = q
		q = r
	return p


## Vrai si la droite de coefficient numerator/denominator passe par la cible.
func hits(numerator: int, denominator: int) -> bool:
	return denominator != 0 and numerator * target.x == (target.y - start.y) * denominator


## Tire le carreau le long de y = a·x + b ; vrai s'il touche la cible.
func shoot(numerator: int, denominator: int) -> bool:
	var a := float(numerator) / float(denominator)
	var hit := hits(numerator, denominator)
	var end_x := float(width)
	if a > 0.0:
		end_x = minf(end_x, (height - start.y) / a)
	elif a < 0.0:
		end_x = minf(end_x, -start.y / a)
	if hit:
		end_x = target.x
	var from := point(0, start.y, 0.12)
	var to := point(end_x, start.y + a * end_x, 0.12)
	var trail := _segment(from, from, 0.05, Color("#ffd27a") if hit else Color("#e46a5a"), self)
	_shots.append(trail)
	var bolt := ProtractorRange.make_arrow(Color("#e8e8f0"))
	bolt.position = from
	add_child(bolt)
	_shots.append(bolt)
	bolt.look_at(bolt.global_position + (to - from), Vector3(0, 0, 1))
	var tween := create_tween()
	tween.tween_method(func(k: float) -> void:
		var p := from.lerp(to, k)
		bolt.position = p
		(trail.mesh as BoxMesh).size.x = maxf(0.01, from.distance_to(p))
		trail.position = (from + p) / 2.0
		trail.rotation.z = atan2(to.y - from.y, to.x - from.x), 0.0, 1.0, 0.6).set_trans(Tween.TRANS_SINE)
	await tween.finished
	return hit


func target_position() -> Vector3:
	return to_global(point(target.x, target.y, 0.1))
