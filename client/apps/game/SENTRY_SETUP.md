# Sentry Error Reporting Setup

This document explains how to set up Sentry error reporting for the Eternum game client.

## Setup Instructions

1. **Create a Sentry Project**
   - Go to [sentry.io](https://sentry.io) and create a new project
   - Select "React" as the platform
   - Copy the DSN (Data Source Name) from your project settings

2. **Configure Environment Variables**
   - Copy `.env.local.sample` to `.env.local`
   - Add your Sentry DSN:
     ```
     VITE_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
     ```

3. **Build Configuration (Optional)**
   - For production builds with source maps, set these environment variables:
     ```
     SENTRY_ORG=your-org-name
     SENTRY_PROJECT=your-project-name
     SENTRY_AUTH_TOKEN=your-auth-token
     ```

## Features Included

- **React Error Boundaries**: Catches and reports React component errors
- **System Call Error Reporting**: Reports Dojo system call errors
- **Performance Monitoring**: Tracks performance metrics and user interactions
- **Session Replay**: Records user sessions for debugging (with privacy controls)
- **Environment Configuration**: Different settings for development/production
- **Graceful Fallback UI**: Shows user-friendly error messages when errors occur

## Configuration

The Sentry integration is configured in `src/sentry.ts` with:
- Environment-based sample rates (lower for production)
- Error filtering (excludes common browser errors)
- User context and tags
- Privacy-focused session replay settings

## Error Boundary

The `ErrorBoundary` component provides:
- Automatic error catching for React components
- Fallback UI with game-themed styling
- Reload button to recover from errors
- Automatic error reporting to Sentry

## Testing

To test the error reporting:
1. Set up Sentry DSN in your environment
2. Add a test error in a component (e.g., `throw new Error("Test error")`)
3. Check your Sentry dashboard for the reported error

## Discord Integration

To pipe errors to Discord (as mentioned in the issue):
1. Set up Sentry alerts in your project settings
2. Configure a webhook integration to your Discord channel
3. Or use Sentry's Discord app for more advanced features

## Privacy Considerations

- Session replay masks sensitive data by default
- Performance monitoring uses sampling to reduce overhead
- Error filtering prevents spam from common browser issues
- No sensitive game data is included in error reports