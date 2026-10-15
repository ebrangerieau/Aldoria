class_name BalanceRig
extends Node3D
## Balance géante d'une salle-énigme (pré-algèbre de Jules) : un fléau sur une colonne, deux
## plateaux qui restent horizontaux, des boîtes de masse inconnue et des billes. Le fléau
## penche du côté le plus lourd. Billes et boîtes sont dessinées par lots (MultiMesh) : une
## centaine de billes coûte un seul appel de dessin (budget tablette).

const ARM := 2.4  # demi-longueur du fléau
const PIVOT_H := 2.3
const HANG := 1.0  # longueur des chaînes sous le fléau
const PLATE_R := 1.15
const MAX_TILT := 12.0  # degrés
const BOX := 0.42
const MARBLE_R := 0.1

var _beam: Node3D
var _plates: Array[Node3D] = []
var _chains: Array[MeshInstance3D] = []
var _boxes: Array[MultiMeshInstance3D] = []
var _marbles: Array[MultiMeshInstance3D] = []
var _counts: Array[Label3D] = []
var _box_labels: Array[Label3D] = []
var _tilt := 0.0
var _tween: Tween
var _vertex := false
var _box_names: Array = ["boîte", "boîtes"]
var _unit_names: Array = ["bille", "billes"]
var _shapes := {}  # nom d'objet → Mesh (boîte, sac, bille, pièce)
var sides := {"left": {"boxes": 0, "units": 0}, "right": {"boxes": 0, "units": 0}}


static func create(wt: WorldTheme, vertex_shading: bool) -> BalanceRig:
	var rig := BalanceRig.new()
	rig._vertex = vertex_shading
	rig._build(wt)
	return rig


func _material(color: Color, metallic := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metallic
	m.roughness = 0.55
	if _vertex:
		m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_VERTEX
	return m


func _mesh(mesh: Mesh, at: Vector3, parent: Node3D) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = at
	parent.add_child(node)
	return node


func _build(wt: WorldTheme) -> void:
	var stone := _material(Color(0.45, 0.42, 0.48))
	var brass := _material(Color(0.86, 0.66, 0.3), 0.6)
	var base := CylinderMesh.new()
	base.top_radius = 0.7
	base.bottom_radius = 0.9
	base.height = 0.3
	base.material = stone
	_mesh(base, Vector3(0, 0.15, 0), self)
	var column := CylinderMesh.new()
	column.top_radius = 0.14
	column.bottom_radius = 0.2
	column.height = PIVOT_H
	column.material = brass
	_mesh(column, Vector3(0, PIVOT_H / 2.0, 0), self)

	_beam = Node3D.new()
	_beam.position.y = PIVOT_H
	add_child(_beam)
	var bar := BoxMesh.new()
	bar.size = Vector3(ARM * 2.0 + 0.3, 0.14, 0.16)
	bar.material = brass
	_mesh(bar, Vector3.ZERO, _beam)
	var knob := SphereMesh.new()
	knob.radius = 0.2
	knob.height = 0.4
	knob.material = _material(wt.accent)
	_mesh(knob, Vector3.ZERO, _beam)

	var chain := CylinderMesh.new()
	chain.top_radius = 0.025
	chain.bottom_radius = 0.025
	chain.height = HANG
	chain.material = brass
	var plate := CylinderMesh.new()
	plate.top_radius = PLATE_R
	plate.bottom_radius = PLATE_R * 0.9
	plate.height = 0.1
	plate.material = brass
	var box := BoxMesh.new()
	box.size = Vector3.ONE * BOX
	box.material = _material(Color(0.62, 0.36, 0.86))
	var sack := SphereMesh.new()
	sack.radius = BOX * 0.55
	sack.height = BOX * 1.0
	sack.radial_segments = 10
	sack.rings = 5
	sack.material = _material(Color(0.66, 0.48, 0.3))
	var marble := SphereMesh.new()
	marble.radius = MARBLE_R
	marble.height = MARBLE_R * 2.0
	marble.radial_segments = 8
	marble.rings = 4
	marble.material = _material(Color(0.3, 0.72, 0.95), 0.2)
	var coin := CylinderMesh.new()
	coin.top_radius = MARBLE_R * 0.95
	coin.bottom_radius = MARBLE_R * 0.95
	coin.height = MARBLE_R * 0.7
	coin.radial_segments = 10
	coin.material = _material(Color(1.0, 0.8, 0.3), 0.7)
	_shapes = {"boîte": box, "sac": sack, "bille": marble, "pièce": coin}
	for side in [-1.0, 1.0]:
		_chains.append(_mesh(chain, Vector3(side * ARM, PIVOT_H - HANG / 2.0, 0), self))
		var holder := Node3D.new()
		add_child(holder)
		_mesh(plate, Vector3.ZERO, holder)
		var boxes := MultiMeshInstance3D.new()
		boxes.multimesh = _multimesh(box)
		holder.add_child(boxes)
		var marbles := MultiMeshInstance3D.new()
		marbles.multimesh = _multimesh(marble)
		holder.add_child(marbles)
		var count := Label3D.new()
		count.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		count.font_size = 64
		count.pixel_size = 0.006
		count.outline_size = 14
		count.modulate = Color.WHITE
		count.position = Vector3(0, 0.78, 0)  # au-dessus des objets, sous le fléau : jamais caché par le renard
		holder.add_child(count)
		_plates.append(holder)
		_boxes.append(boxes)
		_marbles.append(marbles)
		_counts.append(count)
	_place_plates()


static func _multimesh(mesh: Mesh) -> MultiMesh:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	return mm


## Contenu des plateaux (énigme `visual.balance` : boîtes et billes de chaque côté).
func set_sides(left_boxes: int, left_units: int, right_boxes: int, right_units: int) -> void:
	sides = {"left": {"boxes": left_boxes, "units": left_units}, "right": {"boxes": right_boxes, "units": right_units}}
	_fill(0, left_boxes, left_units)
	_fill(1, right_boxes, right_units)
	show_guess(-1)


## Noms des objets (« boîte » ou « sac », « bille » ou « pièce ») : la forme dessinée suit.
func set_names(box: Array, unit: Array) -> void:
	_box_names = box
	_unit_names = unit
	for i in 2:
		_boxes[i].multimesh.mesh = _shapes.get(str(box[0]), _shapes["boîte"])
		_marbles[i].multimesh.mesh = _shapes.get(str(unit[0]), _shapes["bille"])


func _fill(i: int, boxes: int, units: int) -> void:
	var box_spots := _box_spots(boxes)
	var marble_spots := _marble_spots(units, boxes > 0)
	var bmm := _boxes[i].multimesh
	bmm.instance_count = box_spots.size()
	for n in box_spots.size():
		bmm.set_instance_transform(n, Transform3D(Basis(), box_spots[n]))
	var mmm := _marbles[i].multimesh
	mmm.instance_count = marble_spots.size()
	for n in marble_spots.size():
		mmm.set_instance_transform(n, Transform3D(Basis(), marble_spots[n]))
	var parts: Array[String] = []
	if boxes > 0:
		parts.append("%d %s" % [boxes, _box_names[0 if boxes == 1 else 1]])
	if units > 0:
		parts.append("%d %s" % [units, _unit_names[0 if units == 1 else 1]])
	_counts[i].text = " + ".join(parts) if not parts.is_empty() else "vide"


## Boîtes au fond du plateau, quatre par rangée.
static func _box_spots(count: int) -> Array[Vector3]:
	var spots: Array[Vector3] = []
	for n in count:
		var row := int(n / 4.0)
		var in_row := mini(4, count - row * 4)
		var col := n % 4
		spots.append(Vector3((col - (in_row - 1) / 2.0) * (BOX + 0.06), 0.05 + BOX / 2.0, -0.55 + row * (BOX + 0.06)))
	return spots


## Billes en couches : devant les boîtes, ou sur tout le plateau s'il n'y a pas de boîte.
static func _marble_spots(count: int, with_boxes: bool) -> Array[Vector3]:
	var spots: Array[Vector3] = []
	var step := MARBLE_R * 2.05
	var z_from := 0.25 if with_boxes else -0.85
	var z_to := 0.95
	var cells: Array[Vector2] = []
	var z := z_from
	while z <= z_to + 0.001:
		var x := -0.95
		while x <= 0.95 + 0.001:
			if Vector2(x, z).length() <= PLATE_R - MARBLE_R:
				cells.append(Vector2(x, z))
			x += step
		z += step
	var layer := 0
	while spots.size() < count:
		for cell in cells:
			if spots.size() >= count:
				break
			spots.append(Vector3(cell.x, 0.05 + MARBLE_R + layer * step * 0.9, cell.y))
		layer += 1
	return spots


## Affiche la masse essayée sur chaque boîte (-1 : rien).
func show_guess(value: int) -> void:
	for label in _box_labels:
		label.queue_free()
	_box_labels.clear()
	if value < 0:
		return
	for i in 2:
		var side: Dictionary = sides["left" if i == 0 else "right"]
		for spot in _box_spots(int(side["boxes"])):
			var label := Label3D.new()
			label.text = str(value)
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.font_size = 72
			label.pixel_size = 0.006
			label.outline_size = 16
			label.position = spot + Vector3(0, BOX / 2.0 + 0.16, 0)
			_plates[i].add_child(label)
			_box_labels.append(label)


## Penche le fléau : -1 à gauche, 0 en équilibre, 1 à droite.
func tilt_to(direction: int, calm := false) -> void:
	if _tween != null:
		_tween.kill()
	var goal := -direction * MAX_TILT
	_tween = create_tween()
	if calm:
		_tween.tween_method(_set_tilt, _tilt, goal, 0.6).set_trans(Tween.TRANS_SINE)
	else:
		_tween.tween_method(_set_tilt, _tilt, goal, 0.9).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)


func _set_tilt(degrees: float) -> void:
	_tilt = degrees
	_beam.rotation_degrees.z = degrees
	_place_plates()


## Les plateaux pendent sous les extrémités du fléau et restent horizontaux.
func _place_plates() -> void:
	var angle := deg_to_rad(_tilt)
	for i in 2:
		var side := -1.0 if i == 0 else 1.0
		var end := Vector3(side * ARM * cos(angle), PIVOT_H + side * ARM * sin(angle), 0)
		_plates[i].position = end - Vector3(0, HANG, 0)
		_chains[i].position = end - Vector3(0, HANG / 2.0, 0)


func plate_position(left: bool) -> Vector3:
	return _plates[0 if left else 1].global_position
