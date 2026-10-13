class_name AnswerInputs
extends RefCounted
## Tests : saisie qu'un enfant ferait pour répondre juste à un item, quelle que soit la
## forme de la réponse (un combat peut tirer un ordre, un vrai/faux justifié…).


static func correct_for(answer: Dictionary) -> Variant:
	match answer["kind"]:
		"choice":
			return int(answer["index"])
		"vector", "order", "signs":
			return answer["value"]
		"true_false":
			return {"value": answer["value"], "reason": answer["reason"]}
		"text":
			return str(answer["value"][0])
	return str(answer["value"])
