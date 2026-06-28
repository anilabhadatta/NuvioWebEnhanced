# NuvioWebEnhanced

NuvioWebEnhanced is a Next.js web application for streaming media content. It features a custom player built on top of `movi-player` and `shaka-player`, with advanced subtitle styling and cross-platform external player support.

## Prerequisites: NuvioWeb CORS Unlocker Extension

To bypass CORS restrictions when fetching media streams (like Torbox and other streaming APIs) and to enable WebCodecs hardware decoding, you **must** install the bundled Chrome extension.

### How to Install the Extension
1. Open Chrome/Edge/Brave and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right corner).
3. Click **Load unpacked**.
4. Select the `NuvioCorsExtension` folder located in the root of this repository.
5. Make sure the extension is enabled. The extension automatically modifies `Access-Control-Allow-Origin` and `Cross-Origin-Resource-Policy` headers for all requests.

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The CORS extension must be active for video playback to work correctly.

## Deployment to Vercel

NuvioWebEnhanced is optimized for deployment on Vercel.

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com/new) and import your repository.
3. Configure your Environment Variables in the Vercel dashboard by copying the contents of your `.env.local`.
4. Deploy the application.

**Important Note for Users:** Even when deployed to Vercel, end-users will still need to install the `NuvioCorsExtension` to bypass CORS restrictions enforced by external CDN providers like Torbox and MediaFusion.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
