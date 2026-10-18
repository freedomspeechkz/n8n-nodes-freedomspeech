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
			default: 'https://freedomspeech.kz',
			description: 'Адрес API без завершающего слэша / API base URL without a trailing slash',
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

	// Проверка ключа: определение языка короткой строки требует ключ и почти ничего не стоит.
	// Credential test: language detection needs a key and is nearly free.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v2/detect',
			method: 'POST',
			headers: {
				'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) n8n-nodes-freedomspeech',
			},
			body: { text: 'Сәлеметсіз бе' },
		},
	};
}
