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

    const body = parseRequestBody(req);
    const text = body.text?.toString().trim();
    const targetLang = body.targetLang?.toString().toUpperCase();
    const apiKey = body.apiKey?.toString().trim();
    const sourceLang = body.sourceLang?.toString().toUpperCase();

    if (!text || !targetLang || !apiKey) {
        return res.status(400).json({ error: 'text, targetLang, apiKey는 필수입니다.' });
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

    try {
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
            return res.status(200).json(parsed);
        } catch (parseError) {
            console.error('[api/deepl] DeepL JSON parse error:', parseError);
            return res.status(502).json({ error: 'DeepL 응답 파싱 실패', details: payload });
        }
    } catch (error) {
        console.error('[api/deepl] Unexpected error:', error);
        return res.status(500).json({
            error: '서버 오류',
            details: error instanceof Error ? error.message : String(error),
        });
    }
}
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 클라이언트 요청을 받아 DeepL API로 중계하는 Vercel 서버리스 함수

const handler = async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { text, targetLang, apiKey } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text 필드가 필요합니다.' });
    }

    if (!targetLang || typeof targetLang !== 'string') {
      return res.status(400).json({ error: 'targetLang 필드가 필요합니다.' });
    }

    const authKey = typeof apiKey === 'string' && apiKey.trim().length > 0
      ? apiKey.trim()
      : process.env.DEEPL_API_KEY;

    if (!authKey) {
      return res.status(400).json({ error: 'DeepL API 키가 설정되어 있지 않습니다.' });
    }

    const isFree = authKey.endsWith(':fx');
    const endpoint = isFree
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const params = new URLSearchParams();
    params.append('auth_key', authKey);
    params.append('text', text);
    params.append('target_lang', targetLang);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[api/deepl] DeepL response error:', data);
      return res.status(response.status).json({ error: data });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('[api/deepl] Unexpected error:', error);
    return res.status(500).json({ error: 'DeepL 프록시 호출 중 오류가 발생했습니다.' });
  }
};

export default handler;

