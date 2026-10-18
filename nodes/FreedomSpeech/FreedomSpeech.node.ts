import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) n8n-nodes-freedomspeech/0.1.1';
// Адрес по умолчанию, на нём работают ключи из кабинета console.freedomspeech.kz: Transcribe, Speak.
// Translate, Detect Language и Voices на нём пока не опубликованы (404, бэкенд в работе); для них нужен
// другой Base URL в учётных данных. / Default host for console keys; translate, detect and voices are not published there yet.
const DEFAULT_BASE_URL = 'https://api.freedomspeech.kz';

type MultipartField = { name: string; value: string } | { name: string; filename: string; mime: string; data: Buffer };

/** Собрать multipart/form-data без внешних зависимостей. / Build a multipart body with no dependencies. */
function buildMultipart(fields: MultipartField[]): { body: Buffer; contentType: string } {
	const boundary = `----n8nFreedomSpeech${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const parts: Buffer[] = [];
	for (const f of fields) {
		parts.push(Buffer.from(`--${boundary}\r\n`));
		if ('data' in f) {
			parts.push(
				Buffer.from(
					`Content-Disposition: form-data; name="${f.name}"; filename="${f.filename}"\r\nContent-Type: ${f.mime}\r\n\r\n`,
				),
			);
			parts.push(f.data);
		} else {
			parts.push(Buffer.from(`Content-Disposition: form-data; name="${f.name}"\r\n\r\n${f.value}`));
		}
		parts.push(Buffer.from('\r\n'));
	}
	parts.push(Buffer.from(`--${boundary}--\r\n`));
	return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function mimeFor(name: string): string {
	const ext = name.toLowerCase().split('.').pop() ?? '';
	const map: Record<string, string> = {
		wav: 'audio/wav',
		mp3: 'audio/mpeg',
		ogg: 'audio/ogg',
		oga: 'audio/ogg',
		opus: 'audio/ogg',
		flac: 'audio/flac',
		m4a: 'audio/mp4',
		mp4: 'audio/mp4',
		webm: 'audio/webm',
		aac: 'audio/aac',
	};
	return map[ext] ?? 'application/octet-stream';
}

const LANGUAGE_OPTIONS = [
	{ name: 'Auto', value: '' },
	{ name: 'Kazakh (kk)', value: 'kk' },
	{ name: 'Russian (ru)', value: 'ru' },
	{ name: 'English (en)', value: 'en' },
];

const TARGET_LANGUAGE_OPTIONS = [
	{ name: 'Kazakh (kk)', value: 'kk' },
	{ name: 'Russian (ru)', value: 'ru' },
	{ name: 'English (en)', value: 'en' },
];

export class FreedomSpeech implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Freedom Speech',
		name: 'freedomSpeech',
		icon: 'file:freedomspeech.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Speech recognition, speech synthesis, translation and language detection for Kazakh, Russian and English',
		defaults: { name: 'Freedom Speech' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'freedomSpeechApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Transcribe', value: 'transcribe', action: 'Transcribe audio to text', description: 'Audio file from a binary field to text' },
					{ name: 'Speak', value: 'speak', action: 'Synthesize speech', description: 'Text to a WAV file in a binary field' },
					{ name: 'Translate', value: 'translate', action: 'Translate text', description: 'Translate between kk, ru and en' },
					{ name: 'Detect Language', value: 'detect', action: 'Detect language', description: 'Detect the language of a text' },
					{ name: 'Voices', value: 'voices', action: 'List voices', description: 'List available voices' },
				],
				default: 'transcribe',
			},

			// ---------------------------------------------------------------- transcribe
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { operation: ['transcribe'] } },
				description: 'Name of the binary field with the audio file (wav, mp3, ogg, flac, m4a, webm)',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: LANGUAGE_OPTIONS,
				default: '',
				displayOptions: { show: { operation: ['transcribe'] } },
				description: 'Language hint; leave Auto to let the service decide',
			},
			{
				displayName: 'Options',
				name: 'transcribeOptions',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['transcribe'] } },
				options: [
					{
						displayName: 'Prettify',
						name: 'prettify',
						type: 'boolean',
						default: true,
						description: 'Whether to add punctuation and capitalisation',
					},
					{
						displayName: 'Diarize',
						name: 'diarize',
						type: 'boolean',
						default: false,
						description: 'Whether to split the text by speakers',
					},
					{
						displayName: 'Speaker Names',
						name: 'speakerNames',
						type: 'string',
						default: '',
						description: 'Comma-separated names for known speakers (used with Diarize)',
					},
					{
						displayName: 'Model',
						name: 'model',
						type: 'string',
						default: '',
						description: 'Recognition model; leave empty for the default',
					},
				],
			},

			// ---------------------------------------------------------------- speak
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				required: true,
				displayOptions: { show: { operation: ['speak', 'translate', 'detect'] } },
				description: 'Text to process',
			},
			{
				displayName: 'Voice',
				name: 'voice',
				type: 'string',
				default: 'tomiris',
				displayOptions: { show: { operation: ['speak'] } },
				description: 'Voice ID, see the Voices operation (for example tomiris or taymas)',
			},
			{
				displayName: 'Model',
				name: 'model',
				type: 'options',
				options: [
					{ name: 'freedomspeech', value: 'freedomspeech' },
					{ name: 'freedomspeech-flash', value: 'freedomspeech-flash' },
				],
				default: 'freedomspeech',
				displayOptions: { show: { operation: ['speak'] } },
				description: 'Synthesis model',
			},
			{
				displayName: 'Language',
				name: 'speakLanguage',
				type: 'options',
				options: LANGUAGE_OPTIONS,
				default: '',
				displayOptions: { show: { operation: ['speak'] } },
			},
			{
				displayName: 'Emotion',
				name: 'emotion',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['speak'] } },
				description: 'Emotion hint, for example neutral, happy, sad; not wired yet for freedomspeech-flash',
			},
			{
				displayName: 'Output Binary Field',
				name: 'outputBinaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['speak'] } },
				description: 'Name of the binary field that will hold the WAV file',
			},
			{
				displayName: 'File Name',
				name: 'fileName',
				type: 'string',
				default: 'speech.wav',
				displayOptions: { show: { operation: ['speak'] } },
			},

			// ---------------------------------------------------------------- translate
			{
				displayName: 'Target Language',
				name: 'targetLang',
				type: 'options',
				options: TARGET_LANGUAGE_OPTIONS,
				default: 'kk',
				required: true,
				displayOptions: { show: { operation: ['translate'] } },
			},
			{
				displayName: 'Source Language',
				name: 'sourceLang',
				type: 'options',
				options: LANGUAGE_OPTIONS,
				default: '',
				displayOptions: { show: { operation: ['translate'] } },
				description: 'Leave Auto to detect the source language',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = (await this.getCredentials('freedomSpeechApi')) as IDataObject;
		const baseUrl = String(credentials.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');

		const call = async (options: IHttpRequestOptions) => {
			const merged: IHttpRequestOptions = {
				...options,
				url: `${baseUrl}${options.url}`,
				headers: { 'User-Agent': USER_AGENT, Accept: 'application/json, audio/wav', ...(options.headers ?? {}) },
			};
			return this.helpers.httpRequestWithAuthentication.call(this, 'freedomSpeechApi', merged);
		};

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'transcribe') {
					const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
					const language = this.getNodeParameter('language', i, '') as string;
					const opts = this.getNodeParameter('transcribeOptions', i, {}) as IDataObject;
					const binary = this.helpers.assertBinaryData(i, binaryPropertyName);
					const data = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
					const filename = binary.fileName || 'audio.wav';
					const prettify = opts.prettify === undefined ? true : Boolean(opts.prettify);

					const fields: MultipartField[] = [{ name: 'prettify', value: prettify ? 'true' : 'false' }];
					if (opts.diarize) {
						fields.push({ name: 'response_format', value: 'diarized_json' });
						const names = String(opts.speakerNames || '')
							.split(',')
							.map((s) => s.trim())
							.filter(Boolean);
						for (const n of names) fields.push({ name: 'known_speaker_names[]', value: n });
					}
					if (language) fields.push({ name: 'language', value: language });
					if (opts.model) fields.push({ name: 'model', value: String(opts.model) });
					fields.push({ name: 'file', filename, mime: binary.mimeType || mimeFor(filename), data });

					const { body, contentType } = buildMultipart(fields);
					const response = (await call({
						method: 'POST',
						url: '/v1/audio/transcriptions',
						headers: { 'Content-Type': contentType },
						body,
						json: true,
					})) as IDataObject;
					returnData.push({ json: response, pairedItem: { item: i } });
				} else if (operation === 'speak') {
					const text = this.getNodeParameter('text', i) as string;
					if (!text.trim()) throw new NodeOperationError(this.getNode(), 'Text is required', { itemIndex: i });
					const voice = (this.getNodeParameter('voice', i, 'tomiris') as string) || 'tomiris';
					const model = this.getNodeParameter('model', i, 'freedomspeech') as string;
					const language = this.getNodeParameter('speakLanguage', i, '') as string;
					const emotion = this.getNodeParameter('emotion', i, '') as string;
					const outName = (this.getNodeParameter('outputBinaryPropertyName', i, 'data') as string) || 'data';
					const fileName = (this.getNodeParameter('fileName', i, 'speech.wav') as string) || 'speech.wav';

					const body: IDataObject = { input: text, voice, model, response_format: 'wav' };
					if (language) body.language = language;
					if (emotion) body.emotion = emotion;

					const audio = (await call({
						method: 'POST',
						url: '/v1/audio/speech',
						headers: { 'Content-Type': 'application/json', Accept: 'audio/wav' },
						body,
						json: true,
						encoding: 'arraybuffer',
					})) as ArrayBuffer | Buffer;
					const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio);
					const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, 'audio/wav');
					returnData.push({
						json: { voice, model, bytes: buffer.length, fileName },
						binary: { [outName]: binaryData },
						pairedItem: { item: i },
					});
				} else if (operation === 'translate') {
					const text = this.getNodeParameter('text', i) as string;
					if (!text.trim()) throw new NodeOperationError(this.getNode(), 'Text is required', { itemIndex: i });
					const targetLang = this.getNodeParameter('targetLang', i) as string;
					const sourceLang = this.getNodeParameter('sourceLang', i, '') as string;
					const body: IDataObject = { text, target_lang: targetLang };
					if (sourceLang) body.source_lang = sourceLang;
					const response = (await call({
						method: 'POST',
						url: '/v2/translate',
						headers: { 'Content-Type': 'application/json' },
						body,
						json: true,
					})) as IDataObject;
					const first = ((response.translations as IDataObject[] | undefined) ?? [])[0] ?? {};
					returnData.push({
						json: {
							text: first.text ?? '',
							detectedSourceLanguage: first.detected_source_language ?? sourceLang ?? null,
							targetLang,
							raw: response,
						},
						pairedItem: { item: i },
					});
				} else if (operation === 'detect') {
					const text = this.getNodeParameter('text', i) as string;
					if (!text.trim()) throw new NodeOperationError(this.getNode(), 'Text is required', { itemIndex: i });
					const response = (await call({
						method: 'POST',
						url: '/v2/detect',
						headers: { 'Content-Type': 'application/json' },
						body: { text },
						json: true,
					})) as IDataObject;
					const first = ((response.detections as IDataObject[] | undefined) ?? [])[0] ?? {};
					returnData.push({
						json: { text, language: first.detected_source_language ?? null, raw: response },
						pairedItem: { item: i },
					});
				} else if (operation === 'voices') {
					const response = (await call({ method: 'GET', url: '/api/voices', json: true })) as
						| IDataObject
						| IDataObject[];
					const list = Array.isArray(response)
						? response
						: ((response.voices as IDataObject[] | undefined) ?? (response.data as IDataObject[] | undefined) ?? []);
					for (const v of list) returnData.push({ json: v, pairedItem: { item: i } });
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, { itemIndex: i });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
