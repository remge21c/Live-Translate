import type { VercelRequest, VercelResponse } from '@vercel/node';

interface DeepLRequestBody {
    text?: string;
    targetLang?: string;
    apiKey?: string;
    sourceLang?: string;
}

// Vercel이 넘겨주는 body는 문자열일 수도 있으므로 안전하게 파싱한다.
const parseRequestBody = (req: VercelRequest): DeepLRequestBody => {
    if (!req.body) return {};

    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        } catch (error) {
            console.error('[api/deepl] JSON parse error:', error);
            return {};
        }
    }

    return req.body as DeepLRequestBody;
};

// 클라이언트에서 받은 텍스트를 DeepL API로 전달하고 결과를 그대로 반환한다.
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).json({ error: 'POST만 지원합니다.' });
    }

    try {
        const body = parseRequestBody(req);
        const text = body.text?.toString().trim();
        const targetLang = body.targetLang?.toString().toUpperCase();
        // 서버 환경 변수에서만 API 키 사용 (보안 강화)
        const apiKey = (process.env.DEEPL_API_KEY || '').trim();
        const sourceLang = body.sourceLang?.toString().toUpperCase();

        console.log('[api/deepl] Request:', {
            hasText: !!text,
            targetLang,
            hasApiKey: !!apiKey,
            apiKeyPreview: apiKey ? '***' + apiKey.slice(-4) : 'not found'
        });

        if (!text || !targetLang) {
            return res.status(400).json({ error: 'text, targetLang은 필수입니다.' });
        }

        if (!apiKey) {
            console.error('[api/deepl] API key missing');
            return res.status(500).json({ 
                error: 'DeepL API 키가 서버에 설정되지 않았습니다. Vercel 환경 변수 DEEPL_API_KEY를 설정하세요.' 
            });
        }

        const endpoint = apiKey.endsWith(':fx')
            ? 'https://api-free.deepl.com/v2/translate'
            : 'https://api.deepl.com/v2/translate';

        const params = new URLSearchParams();
        params.append('auth_key', apiKey);
        params.append('text', text);
        params.append('target_lang', targetLang);
        if (sourceLang) {
            params.append('source_lang', sourceLang);
        }

        console.log('[api/deepl] Calling DeepL:', endpoint);

        const deeplResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params,
        });

        const payload = await deeplResponse.text();

        if (!deeplResponse.ok) {
            console.error('[api/deepl] DeepL error:', deeplResponse.status, payload);
            return res.status(deeplResponse.status).json({
                error: 'DeepL 요청 실패',
                details: payload,
            });
        }

        try {
            const parsed = JSON.parse(payload);
            console.log('[api/deepl] Success');
            return res.status(200).json(parsed);
        } catch (parseError) {
            console.error('[api/deepl] DeepL JSON parse error:', parseError, 'Payload:', payload);
            return res.status(502).json({ 
                error: 'DeepL 응답 파싱 실패', 
                details: payload.substring(0, 200) // 처음 200자만 반환
            });
        }
    } catch (error) {
        console.error('[api/deepl] Unexpected error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('[api/deepl] Error stack:', errorStack);
        return res.status(500).json({
            error: '서버 오류',
            details: errorMessage,
        });
    }
}
