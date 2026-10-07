import { handleUpload } from '@vercel/blob/client';
import { ipOf, creditsLeft, allowTokenRequest } from '../lib/limits.js';

export default async function handler(req, res) {
  try {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async () => {
        const ip = ipOf(req);
        if ((await creditsLeft(ip)) <= 0) throw new Error("You're out of uploads for today");
        if (!(await allowTokenRequest(ip))) throw new Error('Too many upload attempts today');
        return {
          allowedContentTypes: ['audio/*'],
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    res.json(json);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
}
