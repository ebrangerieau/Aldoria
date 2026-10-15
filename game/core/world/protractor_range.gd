class_name ProtractorRange
extends Node3D
## Stand de tir de Jules : un rapporteur géant peint au sol, l'archer au centre, une cible dans
## une direction (énigme `visual.kind = "rapporteur"`, générateur 6e.angles.tir). L'enfant
## mesure l'angle entre la ligne de départ et la cible ; la flèche part dans la direction donnée.
## Ligne de départ à droite (angles comptés vers la gauche) ou à gauche, avec alors les deux
## graduations d'un vrai rapporteur.

const R := 4.2  # rayon de l'arc gradué
const TARGET_H := 1.15  # hauteur du centre de la cible
const LIFT := 0.14  # au-dessus du relief des dalles

var angle := 0  # angle de la cible, mesuré depuis la ligne de départ
var reference_left := false
var distance := 5.5
var _drawing: Node3D
var _target: Node3D
var _arrows: Array[Node3D] = []
var _wt: WorldTheme


## Nouvelle manche : le rapporteur (graduations de la difficulté) et la cible.
func setup(visual: Dictionary, wt: WorldTheme) -> void:
	_wt = wt
	for node in [_drawing, _target]:
		if node != null:
			node.queue_free()
	for arrow in _arrows:
		arrow.queue_free()
	_arrows.clear()
	angle = int(visual.get("angle", 45))
	reference_left = str(visual.get("reference", "droite")) == "gauche"
	distance = float(visual.get("distance", 5.5))
	_drawing = Node3D.new()
	add_child(_drawing)
	_draw(int(visual.get("minor", 10)), int(visual.get("labels", 30)), bool(visual.get("double_scale", false)))
	_target = make_target(wt)
	_target.position = direction(angle) * distance
	add_child(_target)
	_target.look_at(global_position, Vector3.UP, true)  # face au tireur


## Direction (au sol) d'un angle compté depuis la ligne de départ.
func direction(measured: float) -> Vector3:
	var theta := deg_to_rad(180.0 - measured if reference_left else measured)
	return Vector3(cos(theta), 0, -sin(theta))


## Orientation à donner à un personnage (rotation y, en degrés) pour viser cet angle.
func facing(measured: float) -> float:
	return (180.0 - measured if reference_left else measured) + 90.0


static func _unshaded(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	if color.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m


func _draw(minor: int, labels: int, double_scale: bool) -> void:
	var ink := Color("#fff6dc")
	# Demi-disque translucide et bord de l'arc.
	var fan := ArrayMesh.new()
	var disc := PackedVector3Array()
	var rim := PackedVector3Array()
	var steps := 48
	for i in steps:
		var a0 := PI * i / steps
		var a1 := PI * (i + 1) / steps
		disc.append_array([Vector3.ZERO, Vector3(cos(a1), 0, -sin(a1)) * R, Vector3(cos(a0), 0, -sin(a0)) * R])
		var p0i := Vector3(cos(a0), 0, -sin(a0)) * (R - 0.05)
		var p0o := Vector3(cos(a0), 0, -sin(a0)) * (R + 0.07)
		var p1i := Vector3(cos(a1), 0, -sin(a1)) * (R - 0.05)
		var p1o := Vector3(cos(a1), 0, -sin(a1)) * (R + 0.07)
		rim.append_array([p0i, p1o, p0o, p0i, p1i, p1o])
	# Fond sombre : les graduations claires se lisent sur tous les sols.
	for pair in [[disc, Color(0.12, 0.09, 0.16, 0.72)], [rim, ink]]:
		var arrays := []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = pair[0]
		fan.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		fan.surface_set_material(fan.get_surface_count() - 1, _unshaded(pair[1]))
	var plate := MeshInstance3D.new()
	plate.mesh = fan
	plate.position.y = LIFT
	_drawing.add_child(plate)

	# Graduations (un seul lot) : longues aux nombres, courtes ailleurs.
	var tick := BoxMesh.new()
	tick.size = Vector3(0.07, 0.02, 1.0)
	tick.material = _unshaded(ink)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = tick
	var marks := range(0, 181, minor)
	mm.instance_count = marks.size()
	for i in marks.size():
		var k: int = marks[i]
		var length := 0.6 if k % labels == 0 else 0.3
		var d := Vector3(cos(deg_to_rad(k)), 0, -sin(deg_to_rad(k)))
		var basis := Basis.looking_at(d, Vector3.UP) * Basis.from_scale(Vector3(1, 1, length))
		mm.set_instance_transform(i, Transform3D(basis, d * (R - length / 2.0) + Vector3(0, LIFT + 0.01, 0)))
	var ticks := MultiMeshInstance3D.new()
	ticks.multimesh = mm
	_drawing.add_child(ticks)

	# Nombres : graduation qui part de la droite à l'extérieur ; celle qui part de la gauche à
	# l'intérieur (rapporteur à double graduation).
	for k in range(0, 181, labels):
		var d := Vector3(cos(deg_to_rad(k)), 0, -sin(deg_to_rad(k)))
		var dense := labels < 30  # un nombre tous les 10° : plus petit, pour ne pas se toucher
		_label(str(k), d * (R + 0.6), ink, 52 if dense else 64)
		if double_scale:
			_label(str(180 - k), d * (R - 1.0), Color("#ffd27a"), 40)

	# Diamètre et ligne de départ (épaisse, colorée, avec son nom).
	_bar(Vector3(-R - 0.3, 0, 0), Vector3(R + 0.3, 0, 0), 0.05, ink)
	var side := -1.0 if reference_left else 1.0
	_bar(Vector3.ZERO, Vector3(side * (R + 1.2), 0, 0), 0.14, _wt.accent if _wt.id == "brouillard" else Color("#d8432f"))
	_label("ligne de départ", Vector3(side * (R - 0.4), 0, 0.7), Color("#ffffff"), 44)


func _bar(from: Vector3, to: Vector3, width: float, color: Color) -> void:
	var mesh := BoxMesh.new()
	mesh.size = Vector3(from.distance_to(to), 0.03, width)
	mesh.material = _unshaded(color)
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = (from + to) / 2.0 + Vector3(0, LIFT + 0.02, 0)
	_drawing.add_child(node)


func _label(text: String, at: Vector3, color: Color, size: int) -> void:
	var l := Label3D.new()
	l.text = text
	l.font_size = size
	l.pixel_size = 0.008
	l.outline_size = 12
	l.modulate = color
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.position = at + Vector3(0, 0.25, 0)
	_drawing.add_child(l)


## Cible sur pied (anneaux rouge et blanc), tournée vers son tireur avec `look_at`.
static func make_target(wt: WorldTheme, radius := 0.55) -> Node3D:
	var node := Node3D.new()
	var post := CylinderMesh.new()
	post.top_radius = 0.05
	post.bottom_radius = 0.07
	post.height = TARGET_H
	post.material = _unshaded(Color("#7a5634"))
	var p := MeshInstance3D.new()
	p.mesh = post
	p.position.y = TARGET_H / 2.0
	node.add_child(p)
	var rings := [[1.0, Color("#f4efe3")], [0.75, Color("#d8432f")], [0.5, Color("#f4efe3")], [0.25, wt.accent.lightened(0.1)]]
	for i in rings.size():
		var disc := CylinderMesh.new()
		disc.top_radius = radius * float(rings[i][0])
		disc.bottom_radius = disc.top_radius
		disc.height = 0.04
		disc.radial_segments = 24
		disc.material = _unshaded(rings[i][1])
		var m := MeshInstance3D.new()
		m.mesh = disc
		m.rotation_degrees.x = 90.0
		m.position = Vector3(0, TARGET_H, 0.03 * i)
		node.add_child(m)
	return node


static func make_arrow(color: Color) -> Node3D:
	var arrow := Node3D.new()
	var shaft := CylinderMesh.new()
	shaft.top_radius = 0.05
	shaft.bottom_radius = 0.05
	shaft.height = 1.2
	shaft.material = _unshaded(Color("#8a6236"))
	var s := MeshInstance3D.new()
	s.mesh = shaft
	s.rotation_degrees.x = 90.0  # le long de -z, l'avant de la flèche
	arrow.add_child(s)
	var tip := CylinderMesh.new()
	tip.top_radius = 0.0
	tip.bottom_radius = 0.11
	tip.height = 0.26
	tip.material = _unshaded(color)
	var t := MeshInstance3D.new()
	t.mesh = tip
	t.rotation_degrees.x = -90.0
	t.position.z = -0.72
	arrow.add_child(t)
	return arrow


## Tire une flèche dans la direction donnée ; vrai si elle touche la cible.
func shoot(measured: int) -> bool:
	var hit := measured == angle
	var d := direction(measured)
	var arrow := make_arrow(Color("#e8e8f0"))
	add_child(arrow)
	_arrows.append(arrow)
	var start := d * 0.6 + Vector3(0, 1.2, 0)
	var end := d * (distance - 0.08) + Vector3(0, TARGET_H, 0) if hit else d * (distance + 0.4) + Vector3(0, 0.25, 0)
	arrow.position = start
	arrow.look_at(arrow.global_position + (end - start), Vector3.UP)
	var tween := create_tween()
	tween.tween_property(arrow, "position", end, 0.45).set_trans(Tween.TRANS_SINE)
	await tween.finished
	if not hit:
		var mark := Label3D.new()
		mark.text = "%d°" % measured
		mark.font_size = 44
		mark.pixel_size = 0.008
		mark.outline_size = 12
		mark.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		mark.position = Vector3(0, 0.6, 0)
		arrow.add_child(mark)
	return hit


func target_position() -> Vector3:
	return _target.global_position + Vector3(0, TARGET_H, 0)
