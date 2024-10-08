export const completionHandler = async (request, env) => {
	let model = '@cf/mistral/mistral-7b-instruct-v0.1';
	const created = Math.floor(Date.now() / 1000);
	const uuid = crypto.randomUUID();
	let error = null;

	try {
		// If the POST data is JSON then attach it to our response.
		if (request.headers.get('Content-Type') === 'application/json') {
			let json = await request.json();
			// when there is more than one model available, enable the user to select one
			if (json?.model) {
				const mapper = env.MODEL_MAPPER ?? {};
				model = mapper[json.model] ? mapper[json.model] : json.model;
			}
			if (json?.prompt) {
				if (typeof json.prompt === 'string') {
					if (json.prompt.length === 0) {
						return Response.json({ error: 'no prompt provided' }, { status: 400 });
					}
				}
			}
			if (!json?.stream) json.stream = false;

			let buffer = '';
			const decoder = new TextDecoder();
			const encoder = new TextEncoder();
			const transformer = new TransformStream({
				transform(chunk, controller) {
					buffer += decoder.decode(chunk);
					// Process buffered data and try to find the complete message
					while (true) {
						const newlineIndex = buffer.indexOf('\n');
						if (newlineIndex === -1) {
							// If no line breaks are found, it means there is no complete message, wait for the next chunk
							break;
						}

						// Extract a complete message line
						const line = buffer.slice(0, newlineIndex + 1);
						// console.log(line);
						// console.log("-----------------------------------");
						buffer = buffer.slice(newlineIndex + 1); // Update buffer

						// Process this line
						try {
							if (line.startsWith('data: ')) {
								const content = line.slice('data: '.length);
								// console.log(content);
								const doneflag = content.trim() == '[DONE]';

								const data = JSON.parse(content);
								const newChunk =
									'data: ' +
									JSON.stringify({
										id: uuid,
										created,
										object: 'text_completion',
										model,
										choices: [
											{
												delta: { content: data.response },
												index: 0,
												finish_reason: doneflag ? 'length' : null,
											},
										],
									}) +
									'\n\n';

								if (doneflag) {
									controller.enqueue(encoder.encode(newChunk));
									controller.enqueue(encoder.encode('data: [DONE]\n\n'));
									return;
								} else {
									controller.enqueue(encoder.encode(newChunk));
								}
							}
						} catch (err) {
							console.error('Error parsing line:', err);
						}
					}
				},
			});

			// for now, nothing else does anything. Load the ai model.
			const aiResp = await env.AI.run(model, { stream: json.stream, prompt: json.prompt });
			// Piping the readableStream through the transformStream
			return json.stream
				? new Response(aiResp.pipeThrough(transformer), {
						headers: {
							'content-type': 'text/event-stream',
							'Cache-Control': 'no-cache',
							'Connection': 'keep-alive',
						},
				  })
				: Response.json({
						id: uuid,
						model,
						created,
						object: 'text_completion',
						choices: [
							{
								index: 0,
								text: aiResp.response,
								finish_reason: 'length',
							},
						],
						usage: {
							prompt_tokens: 0,
							completion_tokens: 0,
							total_tokens: 0,
						},
				  });
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
