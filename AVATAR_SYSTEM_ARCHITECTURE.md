# Personalized Avatar System - Architecture & Implementation Guide

## Overview

Create a personalized avatar generation and management system using Fal AI, integrated into the Eternum game's
onboarding flow. Avatars will be tied to Cartridge Controller accounts and stored in PostgreSQL for use throughout the
application.

## Architecture Decision

### Option A: Extend Realtime Server (SELECTED)

**Pros:**

- Already has Hono + Postgres + Drizzle setup
- Reuses existing authentication middleware
- Single deployment/service to maintain
- Database schema lives alongside chat tables

**Cons:**

- Couples avatar management with chat/realtime features
- Server restart affects both systems

### Option B: Separate Avatar Service

**Pros:**

- Clear separation of concerns
- Independent scaling/deployment
- Isolated failures

**Cons:**

- Duplicate Hono + Postgres setup
- Separate authentication implementation
- Additional service to maintain

**Decision: Option A** - The realtime-server is already a general-purpose backend service with perfect infrastructure
for this feature.

---

## Database Schema

Add to `client/apps/realtime-server/src/db/schema/profiles.ts`:

```typescript
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const playerProfiles = pgTable("player_profiles", {
  // Primary key - Cartridge username
  cartridgeUsername: text("cartridge_username").primaryKey(),

  // Player identification
  playerAddress: text("player_address").notNull(),

  // Avatar data
  avatarUrl: text("avatar_url"),
  avatarGenerationPrompt: text("avatar_generation_prompt"),
  falImageId: text("fal_image_id"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

  // Rate limiting
  generationCount: integer("generation_count").default(0).notNull(),
  lastGenerationAt: timestamp("last_generation_at"),
});

export const avatarGenerationLogs = pgTable("avatar_generation_logs", {
  id: text("id").primaryKey(),
  cartridgeUsername: text("cartridge_username").notNull(),
  prompt: text("prompt").notNull(),
  falJobId: text("fal_job_id"),
  status: text("status").notNull(), // 'pending', 'success', 'failed'
  errorMessage: text("error_message"),
  imageUrl: text("image_url"),
  imageUrls: jsonb("image_urls"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Indexes:**

- `player_address` for lookups from game client
- `cartridge_username` (primary key)
- `created_at` for audit queries

---

## API Endpoints

Add to `client/apps/realtime-server/src/http/routes/avatars.ts`:

### 1. **POST /avatars/generate**

Generate a new avatar using Fal AI.

**Request:**

```typescript
{
  prompt: string;
  style?: string;
}
```

**Headers:**

- `x-player-id`: Starknet address
- `x-wallet-address`: Wallet address
- `x-player-name`: Cartridge username

**Response:**

```typescript
{
  success: boolean;
  jobId: string;
  imageUrls: string[];
  profile: {
    avatarUrl: string | null;
  };
}
```

**Logic:**

1. Validate authentication (require `x-player-name`)
2. Check rate limits (max 1 generation per 24 hours per user)
3. Call Fal AI API with prompt
4. Store job in `avatar_generation_logs`
5. Return job ID for polling

### 2. **GET /avatars/status/:jobId**

Poll generation status.

**Response:**

```typescript
{
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrls?: string[];
  error?: string;
}
```

### 3. **GET /avatars/profile/:username**

Get player profile with avatar.

**Response:**

```typescript
{
  cartridgeUsername: string;
  playerAddress: string;
  avatarUrl: string | null;
  createdAt: string;
}
```

### 4. **GET /avatars/profile-by-address/:address**

Get player profile by wallet address.

### 5. **POST /avatars/profiles**

Batch fetch profiles by address list (public).

**Request:**

```typescript
{
  addresses: string[];
}
```

**Response:**

```typescript
{
  profiles: Array<{
    playerAddress: string;
    cartridgeUsername: string | null;
    avatarUrl: string | null;
  }>;
}
```

### 6. **POST /avatars/profiles-by-username**

Batch fetch profiles by username list (public).

**Request:**

```typescript
{
  usernames: string[];
}
```

**Response:**

```typescript
{
  profiles: Array<{
    playerAddress: string;
    cartridgeUsername: string | null;
    avatarUrl: string | null;
  }>;
}
```

### 7. **GET /avatars/me**

Get current user's profile (uses auth headers).

### 8. **PATCH /avatars/me**

Set which avatar to use.

**Request:**

```typescript
{
  imageUrl: string;
}
```

### 9. **DELETE /avatars/me**

Remove avatar and revert to default.

### 10. **GET /avatars/gallery**

Fetch a public gallery of generated avatars.

---

## Fal AI Integration

### Setup

```typescript
// src/services/fal-client.ts
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});

export async function generateAvatar(prompt: string) {
  const result = await fal.subscribe("fal-ai/flux-2/lora", {
    input: {
      prompt: `professional game avatar, ${prompt}, portrait style, clean background`,
      image_size: "square_hd",
      num_inference_steps: 28,
      num_images: 4,
      loras: [
        {
          path: "https://v3b.fal.media/files/b/0a8a72d0/2fIFu-A-H48Vv1lcMyiao_pytorch_lora_weights.safetensors",
          scale: 1,
        },
      ],
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs?.forEach((log) => console.log(log.message));
      }
    },
  });

  return {
    imageUrls: result.data.images.map((image) => image.url),
    jobId: result.requestId,
  };
}
```

### Storage Strategy

**Phase 1: Fal AI Hosting (MVP)**

- Use Fal's temporary URLs directly
- Pros: No storage needed initially
- Cons: URLs expire after 24 hours

**Phase 2: S3/R2 Storage (Production)**

- Upload to S3-compatible storage
- Store permanent URL in database
- Pros: Efficient, CDN-ready, scalable
- Cons: Additional service dependency

---

## Frontend Integration

### 1. Onboarding UI Component

Add to `client/apps/game/src/ui/layouts/unified-onboarding/avatar-creation-panel.tsx`:

```typescript
import { useState } from 'react';
import { Button } from '@/ui/elements/Button';
import { TextInput } from '@/ui/elements/TextInput';

export const AvatarCreationPanel = () => {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`${REALTIME_SERVER_URL}/avatars/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-player-id': playerAddress,
          'x-wallet-address': walletAddress,
          'x-player-name': cartridgeUsername,
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      setJobId(data.jobId);
      pollStatus(data.jobId);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  };

  const pollStatus = async (jobId: string) => {
    const interval = setInterval(async () => {
      const response = await fetch(`${REALTIME_SERVER_URL}/avatars/status/${jobId}`);
      const data = await response.json();

      if (data.status === 'completed') {
        setAvatarUrl(data.imageUrl);
        setGenerating(false);
        clearInterval(interval);
      } else if (data.status === 'failed') {
        setGenerating(false);
        clearInterval(interval);
      }
    }, 2000);
  };

  return (
    <div className="avatar-creation-panel">
      <h2>Create Your Avatar</h2>

      {!avatarUrl ? (
        <>
          <TextInput
            value={prompt}
            onChange={setPrompt}
            placeholder="Describe your avatar: e.g., 'cyberpunk warrior'"
          />

          <Button
            onClick={handleGenerate}
            disabled={generating || !prompt}
          >
            {generating ? 'Generating...' : 'Create Avatar'}
          </Button>
        </>
      ) : (
        <>
          <img src={avatarUrl} alt="Your avatar" className="w-64 h-64" />
          <Button onClick={() => setAvatarUrl(null)}>
            Regenerate
          </Button>
        </>
      )}
    </div>
  );
};
```

### 2. Integrate into Onboarding Flow

Modify `client/apps/game/src/ui/layouts/unified-onboarding/unified-onboarding-screen.tsx`:

Add new step after account connection:

1. Connect Wallet
2. **Create Avatar** ← NEW
3. Select World
4. Enter Game

### 3. Update Existing Avatar Components

**Modify `client/apps/game/src/ui/components/player-id.tsx`:**

```typescript
const AvatarImage = ({ player }: { player: string }) => {
  const { data: profile } = useQuery({
    queryKey: ['avatar', player],
    queryFn: async () => {
      const response = await fetch(`${REALTIME_SERVER_URL}/avatars/profile/${player}`);
      return response.json();
    },
  });

  const avatarUrl = profile?.avatarUrl || getDefaultAvatar(player);

  return (
    <img
      src={avatarUrl}
      alt="Player avatar"
      className="w-12 h-12 rounded-full"
    />
  );
};
```

---

## Environment Configuration

### Realtime Server `.env`

```bash
# Existing
DATABASE_URL=postgresql://user:pass@localhost:5432/eternum

# New
FAL_KEY=your_fal_api_key_here
AVATAR_MAX_GENERATIONS_PER_WEEK=1
AVATAR_STORAGE_TYPE=fal

# Optional for S3 (Phase 2)
AWS_S3_BUCKET=eternum-avatars
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

### Game Client `.env`

```bash
VITE_PUBLIC_REALTIME_SERVER_URL=http://localhost:3001
```

---

## Security Considerations

### 1. **Authentication**

- Require `x-player-name` header (Cartridge username)
- Validate `x-player-id` matches connected wallet
- Consider JWT tokens for stronger auth

### 2. **Rate Limiting**

- Max 1 generation per user per 24 hours
- Implement IP-based rate limiting as backup
- Track in `player_profiles.generationCount`

### 3. **Content Moderation**

- Implement prompt filtering (block offensive terms)
- Consider using Fal's content moderation features
- Log all prompts for audit

### 4. **CORS**

```typescript
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173", "https://eternum.realms.world"],
  }),
);
```

### 5. **Image Validation**

- Verify image dimensions (1024x1024 recommended)
- Check file size limits (< 5MB)
- Validate MIME types (image/png, image/jpeg)

---

## Migration Strategy

### Phase 1: MVP (Week 1)

- [ ] Add database schema to realtime-server
- [ ] Implement API endpoints (Fal integration)
- [ ] Create basic onboarding UI panel
- [ ] Use Fal's temporary URLs (24-hour expiry)

### Phase 2: Integration (Week 2)

- [ ] Update all avatar display components
- [ ] Add mobile onboarding support
- [ ] Implement rate limiting
- [ ] Add error handling & retries

### Phase 3: Production (Week 3+)

- [ ] Set up S3/R2 storage for permanent hosting
- [ ] Add content moderation
- [ ] Implement avatar gallery/history
- [ ] Add social features (avatar showcase)

---

## Testing Strategy

### Unit Tests

- Database operations (profile CRUD)
- Fal API mocking
- Rate limiting logic

### Integration Tests

- Full generation flow (API → Fal → Storage)
- Authentication middleware
- Error scenarios (API failures, timeouts)

### E2E Tests

- Onboarding flow with avatar creation
- Avatar display in various UI contexts
- Mobile avatar creation

---

## Cost Estimation

### Fal AI Pricing

- Flux Schnell model: ~$0.003 per image
- 1000 users × 3 attempts = 3000 images = ~$9/month

### Storage Costs (S3)

- 1024×1024 PNG ≈ 1MB each
- 3000 images = 3GB
- S3 storage: $0.023/GB = ~$0.07/month

**Total: ~$10/month for 1000 active users**

---

## File Structure Summary

```
client/apps/realtime-server/
├── src/
│   ├── db/
│   │   └── schema/
│   │       └── profiles.ts           # NEW
│   ├── http/
│   │   └── routes/
│   │       └── avatars.ts            # NEW
│   ├── services/
│   │   └── fal-client.ts             # NEW
│   └── middleware/
│       └── rate-limit.ts             # NEW

client/apps/game/
├── src/
│   ├── ui/
│   │   ├── layouts/
│   │   │   └── unified-onboarding/
│   │   │       └── avatar-creation-panel.tsx  # NEW
│   │   └── components/
│   │       └── player-id.tsx         # MODIFY
│   └── hooks/
│       └── use-player-avatar.ts      # NEW

packages/types/
└── src/
    └── avatar.ts                     # NEW (shared types)
```

---

## Implementation Checklist

### Backend (Realtime Server)

- [ ] Database schema in `src/db/schema/profiles.ts`
- [ ] Drizzle migration script
- [ ] Fal API integration service (`src/services/fal-client.ts`)
- [ ] Avatar routes (`src/http/routes/avatars.ts`)
- [ ] Rate limiting middleware
- [ ] Environment variables setup
- [ ] CORS configuration
- [ ] Error handling & logging

### Frontend (Game Client)

- [ ] Onboarding UI component (desktop)
- [ ] Integrate into onboarding flow
- [ ] Update PlayerID component
- [ ] Update chat avatar display
- [ ] Add loading/error states
- [ ] Environment variables

### Testing

- [ ] Unit tests (database operations)
- [ ] Integration tests (API endpoints)
- [ ] E2E tests (onboarding flow)

### Documentation

- [ ] API documentation
- [ ] Setup instructions
- [ ] Troubleshooting guide

---

## Future Enhancements

1. **Avatar Customization**
   - Style presets (cyberpunk, fantasy, minimalist)
   - Color theme selection
   - Animation support

2. **Social Features**
   - Avatar gallery/showcase
   - Like/favorite community avatars
   - Share avatar generations

3. **NFT Integration**
   - Mint avatar as NFT
   - Use existing NFT as avatar seed
   - Trade/transfer avatars

4. **Advanced Generation**
   - Multi-style blending
   - Reference image uploads
   - Face customization editor
