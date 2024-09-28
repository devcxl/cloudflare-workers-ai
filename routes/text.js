export const textTranscriptionHandler = async (request, env) => {
	let model = '@cf/meta/m2m100-1.2b';
	let error = null;
	console.log(request.headers.get('Content-Type'));
	try {
		if (request.headers.get('Content-Type') === 'application/json') {
			let json = await request.json();
			if (json?.text && json?.source && json?.target) {
				const resp = await env.AI.run(model, input);
				return Response.json({
					translated: resp.translated_text,
				});
			}
		}
	} catch (e) {
		error = e;
	}

	// if there is no header or it's not json, return an error
	if (error) {
		return Response.json({ error: error.message }, { status: 400 });
	}

	// if we get here, return a 400 error
	return Response.json({ error: 'invalid request' }, { status: 400 });
};
