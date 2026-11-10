/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vernacular Text-To-Speech (TTS) Route
 * Provides authentic Marathi, Hindi, and Indian English audio streaming
 * for rural smallholder farmers who may lack device-level Devanagari TTS.
 */

import { Router, type Request, type Response } from 'express';

const router = Router();

// In-memory audio cache to avoid redundant network roundtrips
const audioCache = new Map<string, { buffer: Buffer; contentType: string }>();

function splitIntoSegments(text: string, maxLen = 170): string[] {
  // Normalize whitespace
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return [clean];

  const segments: string[] = [];
  // Split on sentence boundaries: periods, Devanagari danda (।), exclamation, question mark, or semicolon
  const sentences = clean.split(/([।\.!\?;\n]+)/g);

  let current = '';
  for (let i = 0; i < sentences.length; i++) {
    const part = sentences[i];
    if (!part) continue;

    if (current.length + part.length <= maxLen) {
      current += part;
    } else {
      if (current.trim()) segments.push(current.trim());
      // If a single sentence exceeds maxLen, split on commas or spaces
      if (part.length > maxLen) {
        const words = part.split(/([,,\s]+)/g);
        let sub = '';
        for (const w of words) {
          if (sub.length + w.length <= maxLen) {
            sub += w;
          } else {
            if (sub.trim()) segments.push(sub.trim());
            sub = w;
          }
        }
        current = sub;
      } else {
        current = part;
      }
    }
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments.filter((s) => s.length > 0);
}

async function fetchTTSChunk(text: string, lang: string): Promise<Buffer> {
  const targetLang = lang === 'mr' ? 'mr' : lang === 'hi' ? 'hi' : 'en';
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: 'https://translate.google.com/',
    },
  });

  if (!res.ok) {
    throw new Error(`TTS provider returned HTTP ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const text = typeof req.query.text === 'string' ? req.query.text.trim() : '';
    const lang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'mr';

    if (!text) {
      return res.status(400).json({ error: 'Text query parameter is required' });
    }

    const cacheKey = `${lang}:${text}`;
    const cached = audioCache.get(cacheKey);
    if (cached) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Content-Length', cached.buffer.length);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(cached.buffer);
    }

    const segments = splitIntoSegments(text);
    const chunkBuffers: Buffer[] = [];

    for (const segment of segments) {
      try {
        const buf = await fetchTTSChunk(segment, lang);
        chunkBuffers.push(buf);
      } catch (err: any) {
        console.warn(`[TTS Chunk Warning] Failed for segment "${segment.slice(0, 30)}...":`, err.message);
      }
    }

    if (chunkBuffers.length === 0) {
      return res.status(502).json({ error: 'Failed to synthesize speech audio' });
    }

    const finalBuffer = Buffer.concat(chunkBuffers);
    audioCache.set(cacheKey, { buffer: finalBuffer, contentType: 'audio/mpeg' });

    // Keep cache size bounded
    if (audioCache.size > 200) {
      const firstKey = audioCache.keys().next().value;
      if (firstKey) audioCache.delete(firstKey);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', finalBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(finalBuffer);
  } catch (error: any) {
    console.error('[TTS Error]', error.message);
    return res.status(500).json({ error: 'TTS audio synthesis failed', details: error.message });
  }
});

export default router;
