

# Plan: Admin-Initiated Messaging + Notification Permission Prompt

## Changes

### 1. Admin "New Message" Flow (`src/components/ChatBubble.tsx`)

Currently only students/parents can start new conversations. Add an admin flow:

- When admin clicks "New", show a **recipient picker** — a searchable list of students fetched from the `students` table, displaying `full_name` and `student_id_code`.
- Once admin selects a student, create a new conversation using that student's `user_id` as the conversation partner.
- Set `recipient_role: 'student'` on the inserted message.
- The student (and their linked parent, since parents share conversation visibility via RLS) will see the message in their chat.

**UI**: Replace the empty state for admin with a "New Message" button. On click, show a mini search/select overlay inside the chat panel listing students. Selecting one opens a new thread.

### 2. Notification Permission Prompt

- Add a `notificationPromptShown` state backed by `localStorage` key `chat_notification_prompted`.
- On first chat bubble open, if `Notification.permission === 'default'` and prompt hasn't been shown, display a friendly banner at the top of the chat panel:
  > "Enable notifications to get alerted when new messages arrive."
  > [Enable] [Not now]
- "Enable" calls `Notification.requestPermission()`. "Not now" dismisses and sets the localStorage flag.

### Files Modified
- **`src/components/ChatBubble.tsx`**: Add admin recipient picker, notification prompt banner, and update `startNewConversation` logic for admin role.

No database changes needed — the existing `messages` table and RLS policies already support admin sending messages.

