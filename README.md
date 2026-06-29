# NuvioWebEnhanced

NuvioWebEnhanced is a Next.js web application for streaming media content. It features a custom player built on top of `movi-player` and `shaka-player`, with advanced subtitle styling and cross-platform external player support.

## CORS Handling for Debrid Streams

Some debrid providers (TorBox, Real-Debrid via addon redirects) don't send proper CORS headers on their redirect responses. NuvioWebEnhanced handles this automatically:

### Built-in Server-Side Resolver (Default)

The app includes a lightweight edge resolver (`/api/resolve`) that follows debrid redirect chains server-side and returns the final CDN URL. This works out of the box — no extension needed, works on mobile/iPad/any browser.

- Non-debrid streams play directly (no server call)
- Only CORS-blocked debrid redirects fall through to the resolver
- Zero video bytes are proxied — only the resolved URL passes through

### Optional: NuvioWeb CORS Unlocker Extension (Desktop Only)

If you prefer not to use the server-side resolver (e.g., to avoid any IP differences on the resolve call), you can install the bundled Chrome extension instead. When the extension is active, all CORS restrictions are bypassed client-side and the resolver is never called.

#### How to Install the Extension
1. Open Chrome/Edge/Brave and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `NuvioCorsExtension` folder located in the root of this repository.
5. Make sure the extension is enabled. The extension automatically modifies `Access-Control-Allow-Origin` and `Cross-Origin-Resource-Policy` headers for all requests.

> **Note:** The extension is not available on mobile browsers (iOS Safari, Android Chrome). On mobile, the built-in resolver handles CORS automatically.

## Getting Started (Local Development)

First, install dependencies:
```bash
npm install
```

Make sure to set up your `.env.local` file with the required API keys (Supabase, TMDB, Trakt, etc.) before running the app.

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment to Vercel

NuvioWebEnhanced is optimized for deployment on Vercel.

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/new) and import your repository.
3. Configure your Environment Variables in the Vercel dashboard by copying the contents of your `.env.local`.
4. Deploy the application.

The server-side resolver deploys automatically as an edge function — no extra configuration needed.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
