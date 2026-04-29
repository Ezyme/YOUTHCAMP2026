# media-uploads — patterns

## 1. Buffer-via-`upload_stream` (no temp files)

The Cloudinary SDK supports two upload modes: file path (reads from disk) and stream (pipes data). Next.js serverless can't write tmp files reliably; the stream pattern works everywhere:

```ts
const stream = cloudinary.uploader.upload_stream(opts, callback);
stream.end(buffer);
```

The `Buffer.from(await file.arrayBuffer())` conversion is the bridge from Web's `Blob` to Node's `Buffer`.

## 2. Folder namespacing as `youthcamp/<sub>`

Every upload is prefixed with `youthcamp/`. Lets you isolate this app's assets in the Cloudinary library and identify them in usage reports.

If you ever serve multiple deployments (staging, production) from the same Cloudinary cloud, add another sub-prefix (`youthcamp-staging/...`).

## 3. `resource_type: "auto"` — let Cloudinary detect

Don't hardcode `"image"` or `"video"`. The form input might be either. `auto` picks the right pipeline based on file content.

## 4. Silent config when env vars missing

`configureCloudinary` returns silently if any var is missing. Why: the function is called eagerly at module load (well, at first upload) and an `npm run dev` without keys should still boot. The actual error surfaces at upload time.

Don't change to throw — that breaks dev without Cloudinary keys.

## 5. Server-only by design

The Cloudinary SDK is server-only (uses Node's `fs`, `https`, etc.). Importing it into a client component would error at build. Keep all imports inside `lib/cloudinary.ts` or route handlers.

If you ever need browser-side Cloudinary work (e.g. transformation URL builder), use the `@cloudinary/url-gen` package — it's client-safe and doesn't need credentials.

## 6. Return both `url` and `publicId`

The URL is what `<img src>` uses. The publicId is the stable handle for delete / transform / re-upload. Always return both.

## 7. No client-side direct upload

Cloudinary supports unsigned uploads (preset-based) where the browser POSTs directly. We don't use it. Why:
- It would expose an upload preset (still not the secret, but rate-limited).
- We'd lose server-side control (no place to add admin auth, size validation).
- Going through the Next.js server is one extra hop but trivial in practice.

## 8. Fail fast on env missing

The route checks `CLOUDINARY_CLOUD_NAME && API_KEY && API_SECRET` before parsing the body. Why: if Cloudinary isn't configured, parsing the form data is wasted work. Return 503 immediately.

The internal `uploadGameMedia` also checks `CLOUDINARY_CLOUD_NAME` (alone) as a sentinel — `configureCloudinary` only configures the SDK if all three are set, so checking just one is sufficient defensiveness.
