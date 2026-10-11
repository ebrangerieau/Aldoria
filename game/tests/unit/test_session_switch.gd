extends GutTest
## Appareil partagé : chaque réponse en attente reste rattachée à son joueur.

var _saved: Dictionary


func before_each() -> void:
	_saved = {"token": ApiClient.token, "profile": Session.profile, "queue": Session._queue.duplicate()}
	ApiClient.token = ""  # pas d'envoi réseau
	Session._queue.clear()


func after_each() -> void:
	ApiClient.token = _saved.token
	Session.profile = _saved.profile
	Session._queue = _saved.queue
	Session._save_json(Session.QUEUE_FILE, Session._queue)  # ne pas laisser de fausses réponses


func _item() -> Dictionary:
	return {"id": "6e.fractions.addition:1:1", "generator": "6e.fractions.addition",
		"difficulty": 1, "notions": ["6e.maths.fractions.addition"]}


func test_pending_answers_belong_to_their_player() -> void:
	Session.profile = {"id": 2, "name": "Tom"}
	Session.record_attempt(_item(), true, 3000, false)
	Session.record_attempt(_item(), false, 3000, false)
	assert_eq(Session.pending_count(), 2)

	Session.profile = {"id": 1, "name": "Jules"}
	assert_eq(Session.pending_count(), 0, "Jules ne voit pas les réponses de Tom")
	Session.record_attempt(_item(), true, 3000, false)
	assert_eq(Session.pending_count(), 1)

	Session.profile = {"id": 2, "name": "Tom"}
	assert_eq(Session.pending_count(), 2, "les réponses de Tom attendent son retour")
	assert_eq(Session._queue.size(), 3)


func test_answers_from_before_tagging_go_to_current_player() -> void:
	Session.profile = {"id": 2, "name": "Tom"}
	Session._queue.append({"id": "ancienne-reponse", "correct": true})
	assert_eq(Session.pending_count(), 1)
