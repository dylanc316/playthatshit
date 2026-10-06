# Play That Shit!

## Deploy
1. Push this folder to GitHub and import it in Vercel.
2. In the Vercel project: Storage → create a **Blob** store (adds `BLOB_READ_WRITE_TOKEN`).
3. Storage → Marketplace → add **Upstash Redis** (adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`).
4. Redeploy.

## How sync works
The server stores the current song and the exact server timestamp it started. Each browser
estimates its clock offset from the server, then seeks to `(serverNow - startedAt)`. Drift is corrected on every poll.
