

# Fix: Chat Feature Not Working

## Root Cause

Two critical issues in the `messages` table RLS policies:

1. **Students/parents cannot see admin-initiated messages.** The SELECT policy only shows messages where `sender_id = auth.uid()` or where the user has previously sent a message in that conversation. If the admin starts a conversation, the student has no way to see it because they haven't sent anything yet — the subquery returns empty.

2. **No recipient tracking at the row level.** The table has `recipient_role` (e.g., "student") but no `recipient_id` column to identify *which* student/parent the message is for. This makes it impossible to write a proper SELECT policy for recipients.

## Plan

### 1. Database Migration

- **Add `recipient_id` column** (`uuid`, nullable) to `public.messages` to store the intended recipient's `auth.uid()`.
- **Drop and recreate the flawed RLS policies:**
  - **SELECT**: Allow access if `sender_id = auth.uid()` OR `recipient_id = auth.uid()` (plus the existing admin ALL policy).
  - **INSERT**: Allow authenticated users to insert where `sender_id = auth.uid()` (remove the `sender_role IN ('student','parent')` restriction so admin can also insert).
  - **UPDATE** (mark as read): Allow if `recipient_id = auth.uid()`.

### 2. Update `ChatBubble.tsx`

- **Set `recipient_id` on insert**: When sending a message, include the recipient's user ID.
  - Student/parent → admin: `recipient_id` needs to be determined (admin user ID). Since there may be multiple admins, we can leave it null for admin-bound messages (admin ALL policy handles access), or query for an admin ID.
  - Admin → student: `recipient_id = student.user_id` (already known from recipient picker).
- **Update `loadConversations`**: The current logic groups by `conversation_id` and finds the "other" user by checking `sender_id !== user.id`. With `recipient_id` available, we can also identify conversations where the user is the recipient, even if they haven't replied yet.
- **Update `selectRecipient`**: Pass `student.user_id` so it's stored as `recipient_id` on the first message.

### 3. Conversation visibility fix

For student/parent users who haven't replied yet, the SELECT policy with `recipient_id = auth.uid()` will now surface admin-initiated messages. The `loadConversations` function will pick these up automatically since the query already fetches all visible messages.

### Files Changed
- **Database migration**: Add `recipient_id` column, recreate 3 RLS policies
- **`src/components/ChatBubble.tsx`**: Pass `recipient_id` in message inserts, track active recipient user ID in state

