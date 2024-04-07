import { Router, cors, json, error } from 'itty-router';
const { preflight, corsify } = cors();
// import the routes
import { chatHandler } from './routes/chat';
import { completionHandler } from './routes/completion';
import { embeddingsHandler } from './routes/embeddings';
import { transcriptionHandler, translationHandler } from './routes/audio';
import { getImageHandler, imageGenerationHandler } from './routes/image';

const withAuthenticatedUser = request => {
	const token = request.headers.get('Authorization');
	if (!token) return error(401, '错误的token');
	console.log(token);
};

// Create a new router
const router = Router();

router.options('*', preflight);

router
	.all('*', withAuthenticatedUser)
	.post('/v1/chat/completions', chatHandler)
	.post('/v1/completions', completionHandler)
	.post('/v1/embeddings', embeddingsHandler)
	.post('/v1/audio/transcriptions', transcriptionHandler)
	.post('/v1/audio/translations', translationHandler)
	.post('/v1/images/generations', imageGenerationHandler)
	.get('/v1/images/get/:name', getImageHandler)
	.then(r => corsify(r, request));
// 404 for everything else
router.all('*', () => new Response('404, not found!', { status: 404 }));

export default {
	fetch: router.fetch
};
