import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

/**
 * Учётные данные Freedom Speech: ключ API передаётся в заголовке X-API-Key.
 * Freedom Speech credentials: the API key goes into the X-API-Key header.
 */
export class FreedomSpeechApi implements ICredentialType {
	name = 'freedomSpeechApi';

	displayName = 'Freedom Speech API';

	documentationUrl = 'https://freedomspeech.kz/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Ключ из личного кабинета freedomspeech.kz / API key from the freedomspeech.kz dashboard',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.freedomspeech.kz',
			description: 'Адрес API без завершающего слэша; ключ из кабинета console.freedomspeech.kz работает на https://api.freedomspeech.kz / API base URL without a trailing slash; console keys work on https://api.freedomspeech.kz',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	// Проверка ключа: синтез одного короткого слова. Раньше было определение языка (/v2/detect),
	// но на адресе по умолчанию api.freedomspeech.kz этот маршрут пока не опубликован.
	// Credential test: synthesize one short word; /v2/detect is not published on the default host yet.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/audio/speech',
			method: 'POST',
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) n8n-nodes-freedomspeech',
			},
			body: { input: 'Сәлем', voice: 'tomiris' },
		},
	};
}
