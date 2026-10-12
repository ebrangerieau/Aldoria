"""Retire d'un .glb les animations en double (exports FBX2glTF : chaque animation existe
aussi sous le nom « Armature|Nom »). Les données binaires restent, mais Godot n'importe
que ce que le JSON référence : l'export web n'emporte que les animations gardées.

Usage : python tools/strip_glb_animations.py source.glb destination.glb [préfixe]
"""

import json
import struct
import sys


def main(source: str, destination: str, prefix: str = "AnimalArmature|") -> None:
    data = open(source, "rb").read()
    magic, version, _ = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2, "pas un glb 2.0"
    json_length, json_type = struct.unpack_from("<I4s", data, 12)
    assert json_type == b"JSON"
    gltf = json.loads(data[20 : 20 + json_length])
    rest = data[20 + json_length :]  # bloc binaire inchangé

    before = len(gltf.get("animations", []))
    gltf["animations"] = [a for a in gltf.get("animations", []) if not a.get("name", "").startswith(prefix)]
    print(f"animations : {before} -> {len(gltf['animations'])}")

    text = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)  # alignement sur 4 octets (espaces, norme glb)
    total = 12 + 8 + len(text) + len(rest)
    with open(destination, "wb") as out:
        out.write(struct.pack("<4sII", b"glTF", 2, total))
        out.write(struct.pack("<I4s", len(text), b"JSON"))
        out.write(text)
        out.write(rest)


if __name__ == "__main__":
    main(*sys.argv[1:])
