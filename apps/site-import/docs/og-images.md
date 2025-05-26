# Dynamic OG Images Implementation

This project supports dynamic Open Graph (OG) images for better social media sharing. Here's how it works:

## Deployment Options for Vite Sites

Since this is a Vite site, you need to host the OG image API separately from your static site. Here are your options:

### Option 1: Vercel (Recommended)

Vercel supports both static sites and edge functions in the same deployment:

1. **Install dependencies:**

   ```bash
   pnpm add -D @vercel/og
   ```

2. **Configure `vercel.json`:**

   ```json
   {
     "functions": {
       "api/og.tsx": {
         "runtime": "@vercel/og"
       }
     },
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "/api/$1"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```

3. **Deploy to Vercel:**

   ```bash
   vercel
   ```

4. **Set environment variables in Vercel dashboard:**
   - `VITE_USE_DYNAMIC_OG=true`
   - `VITE_BASE_URL=https://your-domain.vercel.app`

### Option 2: Netlify with Edge Functions

1. **Create `netlify/edge-functions/og.ts`:**

   ```typescript
   import { ImageResponse } from "https://deno.land/x/og_edge/mod.ts";

   export default async function handler(request: Request) {
     // Your OG generation logic
   }

   export const config = { path: "/api/og" };
   ```

2. **Configure `netlify.toml`:**
   ```toml
   [[edge_functions]]
   path = "/api/og"
   function = "og"
   ```

### Option 3: Cloudflare Workers

1. **Create a separate Workers project:**

   ```bash
   npm create cloudflare@latest og-image-worker
   ```

2. **Deploy the worker and update your environment variable:**
   ```env
   VITE_BASE_URL=https://og-image-worker.your-subdomain.workers.dev
   ```

### Option 4: Separate API Service

Host the OG image API as a separate service:

1. **Create a minimal Express/Hono server**
2. **Deploy to Railway, Render, or Fly.io**
3. **Update your base URL to point to the API**

### Option 5: Use External Services (No Hosting Required)

If you don't want to host the API yourself:

1. **Update `src/lib/og-image.ts`:**

   ```typescript
   // Option 2: Use an external service like og-image.vercel.app
   return `https://og-image.vercel.app/${encodeURIComponent(
     params.title
   )}.png?theme=dark&md=1&fontSize=100px`;
   ```

2. **Or use other services:**
   - [Bannerbear](https://www.bannerbear.com/)
   - [Placid](https://placid.app/)
   - [Cloudinary](https://cloudinary.com/)

## Setup

### 1. Basic Implementation (Current)

The project uses a utility function `generateMetaTags()` that creates all necessary meta tags including OG images.

```typescript
import { generateMetaTags } from "@/lib/og-image";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: generateMetaTags({
      title: "Your Page Title",
      description: "Your page description",
      path: "/your-path",
      image: "/custom-og-image.png", // Optional custom image
    }),
  }),
});
```

### 2. Static OG Images

By default, the system uses static OG images. Place your OG images in the `public` folder:

- `/public/og-default.png` - Default OG image (1200x630px)
- `/public/og-games.png` - Games page OG image
- `/public/og-[page].png` - Page-specific OG images

### 3. Dynamic OG Images with Vercel

To enable dynamic OG image generation:

1. Install the Vercel OG package:

```bash
npm install @vercel/og
```

2. Set the environment variable:

```env
VITE_USE_DYNAMIC_OG=true
VITE_BASE_URL=https://your-domain.com
```

3. Deploy the `/api/og.tsx` edge function with your Vercel deployment

4. The system will automatically generate OG images with:
   - Dynamic titles and descriptions
   - Consistent branding
   - Dark theme with Realms World styling
   - Path information

## Usage Examples

### Home Page

```typescript
generateMetaTags({
  title: "Realms World - Onchain Gaming Powered by $LORDS",
  description: "The future of gaming is onchain.",
  path: "/",
});
```

### Game Detail Page

```typescript
generateMetaTags({
  title: `${game.title} - Realms World`,
  description: game.description,
  path: `/games/${game.slug}`,
  image: game.ogImage || game.image, // Use game's OG image or screenshot
});
```

### Custom OG Image

```typescript
generateMetaTags({
  title: "Treasury - Realms World",
  description: "DAO Treasury and Governance",
  image: "/og-treasury.png", // Custom static image
});
```

## Generated Meta Tags

The `generateMetaTags()` function generates:

- Basic meta tags (title, description)
- Open Graph tags (og:title, og:description, og:image, etc.)
- Twitter Card tags
- Image dimensions (1200x630)
- Site name and type

## Best Practices

1. **Image Dimensions**: Always use 1200x630px for OG images
2. **File Size**: Keep images under 1MB for faster loading
3. **Text Contrast**: Ensure text is readable on social media previews
4. **Dynamic Content**: Use dynamic generation for pages with frequently changing content
5. **Fallbacks**: Always have a default OG image as fallback

## Testing

Test your OG images using:

- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## Troubleshooting

1. **Images not updating**: Social platforms cache OG images. Use their debugging tools to refresh.
2. **Vercel function not working**: Check your Vercel deployment logs and ensure the function is deployed.
3. **Wrong image showing**: Verify the meta tags are being rendered correctly in the page source.
