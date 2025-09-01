# N8N Integration Guide

This document provides information about the n8n integration for the Telegram bot functionality and includes sample data for testing.

## Overview

The application integrates with n8n for handling Telegram bot interactions and notifications. The integration consists of:

1. **Telegram Bot Callback** - When users interact with the Telegram bot
2. **Notification Webhooks** - For sending notifications to users
3. **Integration Status Updates** - For tracking successful/failed integrations

## API Endpoints

### 1. Telegram Integration Callback
- **URL**: `/api/telegram/callback`
- **Method**: `POST`
- **Purpose**: Handle Telegram bot integration requests

### 2. Telegram Unlink Webhook
- **URL**: `/api/telegram/unlink`
- **Method**: `POST`
- **Purpose**: Handle Telegram account unlinking

## Sample Data for Testing

### 1. Telegram Integration Callback (Successful)

```json
{
  "email": "user@example.com",
  "telegram_id": "123456789",
  "code": "ABC123"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Telegram integration successful"
}
```

**N8N Webhook Payload (sent to n8n):**
```json
{
  "email": "user@example.com",
  "telegram_id": "123456789",
  "action": "integration_successful",
  "telegram_message": "Welcome to ShadowFlow! Your account has been successfully linked."
}
```

### 2. Telegram Unlink Webhook (Successful)

**N8N Webhook Payload (sent to n8n):**
```json
{
  "email": "user@example.com",
  "telegram_id": "123456789",
  "action": "integration_removed",
  "telegram_message": "Your ShadowFlow account has been unlinked. You will no longer receive task notifications."
}
```

### 2. Telegram Integration Callback (Invalid Code)

```json
{
  "email": "user@example.com",
  "telegram_id": "123456789",
  "code": "INVALID"
}
```

**Expected Response:**
```json
{
  "error": "Invalid or expired integration code"
}
```

### 3. Telegram Integration Callback (Missing Fields)

```json
{
  "email": "user@example.com",
  "telegram_id": "123456789"
}
```

**Expected Response:**
```json
{
  "error": "Missing required fields: email, telegram_id, code"
}
```

### 4. Telegram Integration Callback (User Not Found)

```json
{
  "email": "nonexistent@example.com",
  "telegram_id": "123456789",
  "code": "ABC123"
}
```

**Expected Response:**
```json
{
  "error": "User not found"
}
```

## Testing with cURL

### Test Successful Integration
```bash
curl -X POST http://localhost:3000/api/telegram/callback \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "telegram_id": "123456789",
    "code": "ABC123"
  }'
```

### Test Invalid Code
```bash
curl -X POST http://localhost:3000/api/telegram/callback \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "telegram_id": "123456789",
    "code": "INVALID"
  }'
```

### Test Missing Fields
```bash
curl -X POST http://localhost:3000/api/telegram/callback \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "telegram_id": "123456789"
  }'
```

## N8N Workflow Integration

### 1. Telegram Bot Workflow

The n8n workflow should:

1. **Receive Telegram Message** - Listen for messages from users
2. **Extract Code** - Parse the integration code from the message
3. **Validate User** - Check if the user exists in the system
4. **Call Integration API** - Send data to `/api/telegram/callback`
5. **Send Response** - Reply to the user with success/error message

### 2. Notification Workflow

The n8n workflow should:

1. **Receive Webhook** - Listen for notification requests
2. **Process Notification** - Handle different notification types
3. **Send Telegram Message** - Send message to user's Telegram ID

## Environment Variables

Make sure these environment variables are set in your n8n instance:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
N8N_ENRICHMENT_WEBHOOK_URL=http://localhost:5678/webhook/task-enrichment
N8N_TO_TELEGRAM_NOTIFICATION_WEBHOOK_URL=http://localhost:5678/webhook/telegram-notification
TELEGRAM_MSG_BOT_WELCOME=Welcome to ShadowFlow! Your account has been successfully linked.
TELEGRAM_MSG_BOT_UNLINK=Your ShadowFlow account has been unlinked. You will no longer receive task notifications.
TELEGRAM_MSG_ENRICH_DONE=Your task has been enriched with helpful suggestions!
```

## Database Schema

### telegram_integration_codes Table
```sql
CREATE TABLE telegram_integration_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  telegram_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### todo_users Table
```sql
-- The todo_users table should have a telegram_id column
ALTER TABLE todo_users ADD COLUMN telegram_id TEXT;
```

## Error Handling

The callback API handles various error scenarios:

1. **Invalid/Expired Code** - Returns 400 with error message
2. **User Not Found** - Returns 404 with error message
3. **Missing Fields** - Returns 400 with error message
4. **Database Errors** - Returns 500 with error message

## Security Considerations

1. **Code Validation** - Codes are validated for expiration and usage
2. **User Verification** - Users are verified before integration
3. **Rate Limiting** - Consider implementing rate limiting for the callback endpoint
4. **Input Validation** - All inputs are validated and sanitized

## Monitoring and Logging

The callback API includes comprehensive logging:

- Integration attempts (successful and failed)
- Error details for debugging
- User and code information for tracking

Check the application logs to monitor integration activity and troubleshoot issues.

## Testing Checklist

- [ ] Valid integration code works
- [ ] Invalid code returns error
- [ ] Expired code returns error
- [ ] Missing fields return error
- [ ] Non-existent user returns error
- [ ] Database updates correctly
- [ ] Real-time UI updates work
- [ ] Success messages display correctly
- [ ] Error messages display correctly
