extends SceneTree
## Icônes de l'application installée (téléphone, tablette) : le château de la Citadelle en or
## (game-icons.net, CC BY 3.0, déjà crédité) sur un fond de nuit, dans la zone sûre des icônes
## « maskable » d'Android (cercle central de 80 %). Écrit deploy/pwa/icon-192.png et icon-512.png.
##
## Usage : godot --headless --path game --script ../tools/make_app_icons.gd

const OUT := "res://../deploy/pwa/"
const ICON := "res://assets/ui/icons/castle.svg"
const NIGHT_IN := Color("#2b2340")
const NIGHT_OUT := Color("#110e1a")
const GOLD := Color("#f2c76b")


func _init() -> void:
	var svg := FileAccess.get_file_as_string(ICON)
	for size in [192, 512]:
		var image := Image.create_empty(size, size, false, Image.FORMAT_RGBA8)
		var center: Vector2 = Vector2(size, size) / 2.0
		for y in size:
			for x in size:
				var k := clampf(Vector2(x, y).distance_to(center) / (size * 0.7), 0.0, 1.0)
				image.set_pixel(x, y, NIGHT_IN.lerp(NIGHT_OUT, k))
		# Château : 62 % de l'icône, dans la zone sûre ; blanc dans le fichier, teinté en or ici.
		var glyph := Image.new()
		var scale: float = size * 0.62 / 512.0
		glyph.load_svg_from_string(svg, scale)
		var offset: Vector2i = (Vector2i(size, size) - glyph.get_size()) / 2
		for y in glyph.get_height():
			for x in glyph.get_width():
				var a := glyph.get_pixel(x, y).a
				if a > 0.0:
					var p := Vector2i(x, y) + offset
					image.set_pixelv(p, image.get_pixelv(p).lerp(GOLD, a))
		var path := ProjectSettings.globalize_path(OUT) + "icon-%d.png" % size
		image.save_png(path)
		print("Icône : ", path)
	quit()
