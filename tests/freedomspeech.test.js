// Тесты ноды без n8n и без сети: execute() вызывается с поддельным контекстом IExecuteFunctions.
// Node tests without n8n and without network: execute() runs against a fake IExecuteFunctions context.
const test = require('node:test');
const assert = require('node:assert/strict');

const { FreedomSpeech } = require('../dist/nodes/FreedomSpeech/FreedomSpeech.node.js');
const { FreedomSpeechApi } = require('../dist/credentials/FreedomSpeechApi.credentials.js');

function makeContext({ params, items, responses, credentials }) {
	const calls = [];
	let n = 0;
	const ctx = {
		getInputData: () => items,
		getNodeParameter: (name, i, fallback) => (name in params ? params[name] : fallback),
		getCredentials: async () => ({ apiKey: 'test-key', baseUrl: 'https://api.freedomspeech.kz', ...(credentials || {}) }),
		getNode: () => ({ name: 'Freedom Speech', type: 'freedomSpeech' }),
		continueOnFail: () => false,
		helpers: {
			httpRequestWithAuthentication: async function (credName, options) {
				calls.push({ credName, options });
				const r = responses[n++];
				if (r instanceof Error) throw r;
				return r;
			},
			assertBinaryData: (i, prop) => {
				const b = items[i].binary && items[i].binary[prop];
				if (!b) throw new Error(`no binary ${prop}`);
				return b;
			},
			getBinaryDataBuffer: async (i, prop) => Buffer.from(items[i].binary[prop].data, 'base64'),
			prepareBinaryData: async (buffer, fileName, mimeType) => ({
				data: buffer.toString('base64'),
				fileName,
				mimeType,
				fileSize: `${buffer.length} B`,
			}),
		},
	};
	return { ctx, calls };
}

test('credentials: X-API-Key header and a key-protected test request', () => {
	const c = new FreedomSpeechApi();
	assert.equal(c.name, 'freedomSpeechApi');
	assert.equal(c.authenticate.properties.headers['X-API-Key'], '={{$credentials.apiKey}}');
	assert.equal(c.test.request.url, '/v1/audio/speech');
	assert.equal(c.test.request.method, 'POST');
	assert.ok(c.properties.find((p) => p.name === 'apiKey').typeOptions.password);
});

test('node description lists the five operations', () => {
	const node = new FreedomSpeech();
	const op = node.description.properties.find((p) => p.name === 'operation');
	assert.deepEqual(
		op.options.map((o) => o.value),
		['transcribe', 'speak', 'translate', 'detect', 'voices'],
	);
	assert.equal(node.description.credentials[0].name, 'freedomSpeechApi');
	assert.equal(node.description.icon, 'file:freedomspeech.svg');
});

test('transcribe: multipart with file, prettify, diarization fields and language', async () => {
	const wav = Buffer.from('RIFF....WAVEfake');
	const { ctx, calls } = makeContext({
		params: {
			operation: 'transcribe',
			binaryPropertyName: 'audio',
			language: 'kk',
			transcribeOptions: { prettify: false, diarize: true, speakerNames: 'Асан, Үсен', model: 'conformer' },
		},
		items: [{ json: {}, binary: { audio: { data: wav.toString('base64'), fileName: 'call.wav', mimeType: 'audio/wav' } } }],
		responses: [{ text: 'Сәлем', language: 'kk', segments: [] }],
	});
	const out = await new FreedomSpeech().execute.call(ctx);
	assert.equal(out[0][0].json.text, 'Сәлем');
	assert.equal(calls.length, 1);
	const { options } = calls[0];
	assert.equal(options.method, 'POST');
	assert.equal(options.url, 'https://api.freedomspeech.kz/v1/audio/transcriptions');
	assert.match(options.headers['Content-Type'], /^multipart\/form-data; boundary=/);
	assert.match(options.headers['User-Agent'], /^Mozilla\/5\.0/);
	const body = options.body.toString('latin1');
	const boundary = options.headers['Content-Type'].split('boundary=')[1];
	assert.ok(body.startsWith(`--${boundary}\r\n`));
	assert.ok(body.endsWith(`--${boundary}--\r\n`));
	assert.ok(body.includes('name="prettify"\r\n\r\nfalse'));
	assert.ok(body.includes('name="response_format"\r\n\r\ndiarized_json'));
	assert.ok(body.includes('name="language"\r\n\r\nkk'));
	assert.ok(body.includes('name="model"\r\n\r\nconformer'));
	assert.equal((body.match(/name="known_speaker_names\[\]"/g) || []).length, 2);
	assert.ok(body.includes('name="file"; filename="call.wav"\r\nContent-Type: audio/wav\r\n\r\nRIFF....WAVEfake\r\n'));
});

test('transcribe: default options send prettify=true and no diarization', async () => {
	const { ctx, calls } = makeContext({
		params: { operation: 'transcribe', binaryPropertyName: 'data', language: '', transcribeOptions: {} },
		items: [{ json: {}, binary: { data: { data: Buffer.from('x').toString('base64'), fileName: 'a.mp3' } } }],
		responses: [{ text: 'ok' }],
	});
	await new FreedomSpeech().execute.call(ctx);
	const body = calls[0].options.body.toString('latin1');
	assert.ok(body.includes('name="prettify"\r\n\r\ntrue'));
	assert.ok(!body.includes('response_format'));
	assert.ok(!body.includes('name="language"'));
	assert.ok(body.includes('Content-Type: audio/mpeg'));
});

test('speak: JSON body and WAV in the output binary field', async () => {
	const wav = Buffer.from('RIFFxxxxWAVEdata');
	const { ctx, calls } = makeContext({
		params: {
			operation: 'speak',
			text: 'Сәлеметсіз бе',
			voice: 'taymas',
			model: 'freedomspeech-flash',
			speakLanguage: 'kk',
			emotion: '',
			outputBinaryPropertyName: 'audio',
			fileName: 'hello.wav',
		},
		items: [{ json: {} }],
		responses: [wav],
	});
	const out = await new FreedomSpeech().execute.call(ctx);
	const { options } = calls[0];
	assert.equal(options.url, 'https://api.freedomspeech.kz/v1/audio/speech');
	assert.equal(options.encoding, 'arraybuffer');
	assert.deepEqual(options.body, { input: 'Сәлеметсіз бе', voice: 'taymas', model: 'freedomspeech-flash', response_format: 'wav', language: 'kk' });
	assert.equal(out[0][0].binary.audio.fileName, 'hello.wav');
	assert.equal(out[0][0].binary.audio.mimeType, 'audio/wav');
	assert.equal(Buffer.from(out[0][0].binary.audio.data, 'base64').toString(), 'RIFFxxxxWAVEdata');
	assert.equal(out[0][0].json.bytes, wav.length);
});

test('speak: empty text fails before any request', async () => {
	const { ctx, calls } = makeContext({
		params: { operation: 'speak', text: '   ' },
		items: [{ json: {} }],
		responses: [],
	});
	await assert.rejects(() => new FreedomSpeech().execute.call(ctx), /Text is required/);
	assert.equal(calls.length, 0);
});

test('translate: target and optional source, first translation flattened', async () => {
	const { ctx, calls } = makeContext({
		params: { operation: 'translate', text: 'Hello', targetLang: 'kk', sourceLang: '' },
		items: [{ json: {} }],
		responses: [{ translations: [{ text: 'Сәлем', detected_source_language: 'en' }] }],
	});
	const out = await new FreedomSpeech().execute.call(ctx);
	assert.deepEqual(calls[0].options.body, { text: 'Hello', target_lang: 'kk' });
	assert.equal(out[0][0].json.text, 'Сәлем');
	assert.equal(out[0][0].json.detectedSourceLanguage, 'en');
});

test('detect: language from detections[0]', async () => {
	const { ctx, calls } = makeContext({
		params: { operation: 'detect', text: 'Қалайсың' },
		items: [{ json: {} }],
		responses: [{ detections: [{ text: 'Қалайсың', detected_source_language: 'kk' }] }],
	});
	const out = await new FreedomSpeech().execute.call(ctx);
	assert.equal(calls[0].options.url, 'https://api.freedomspeech.kz/v2/detect');
	assert.equal(out[0][0].json.language, 'kk');
});

test('voices: one output item per voice, list or {voices} shapes', async () => {
	for (const shape of [[{ id: 'tomiris' }, { id: 'taymas' }], { voices: [{ id: 'tomiris' }, { id: 'taymas' }] }]) {
		const { ctx } = makeContext({ params: { operation: 'voices' }, items: [{ json: {} }], responses: [shape] });
		const out = await new FreedomSpeech().execute.call(ctx);
		assert.deepEqual(out[0].map((x) => x.json.id), ['tomiris', 'taymas']);
	}
});

test('custom baseUrl from credentials and trailing slash trimming', async () => {
	const { ctx, calls } = makeContext({
		params: { operation: 'voices' },
		items: [{ json: {} }],
		responses: [[]],
		credentials: { baseUrl: 'https://example.test/' },
	});
	await new FreedomSpeech().execute.call(ctx);
	assert.equal(calls[0].options.url, 'https://example.test/api/voices');
	assert.equal(calls[0].credName, 'freedomSpeechApi');
});

test('continueOnFail: error goes to json.error instead of throwing', async () => {
	const { ctx } = makeContext({
		params: { operation: 'detect', text: 'x' },
		items: [{ json: {} }],
		responses: [new Error('401 Unauthorized')],
	});
	ctx.continueOnFail = () => true;
	const out = await new FreedomSpeech().execute.call(ctx);
	assert.equal(out[0][0].json.error, '401 Unauthorized');
});
