

## Fix Plan: Vercel 404 Error on Page Refresh

### The Problem

When you deploy a Single Page Application (SPA) to Vercel and refresh any page (like `/auth`, `/dashboard`, `/admin`), Vercel returns a 404 error. This happens because:

1. Your app uses client-side routing (React Router)
2. Vercel looks for actual files at those paths (e.g., `/auth/index.html`)
3. Those files don't exist - there's only one `index.html` at the root
4. Result: 404 NOT_FOUND

### The Solution

Create a `vercel.json` configuration file that tells Vercel to redirect all requests to `index.html`, allowing React Router to handle the routing.

---

### Implementation

**Create new file: `vercel.json`** (in project root)

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

This single configuration tells Vercel:
- For ANY route requested (e.g., `/auth`, `/dashboard`, `/admin/exam/123/questions`)
- Serve the `index.html` file
- Let React Router handle the actual routing on the client side

---

### How It Works

```text
User visits: https://your-app.vercel.app/dashboard

WITHOUT vercel.json:
  Vercel → looks for /dashboard/index.html → NOT FOUND → 404 error

WITH vercel.json:
  Vercel → rewrites to /index.html → React loads → Router sees /dashboard → Dashboard component renders
```

---

### After Deployment

Once the `vercel.json` file is added and deployed:

1. All routes will work on refresh (`/auth`, `/dashboard`, `/admin`, `/exam/take`, etc.)
2. Deep linking will work (sharing URLs directly)
3. Browser back/forward buttons will work correctly
4. The 404 page defined in your app (`<Route path="*" element={<NotFound />} />`) will handle truly invalid routes

---

### Summary

| Action | File |
|--------|------|
| Create | `vercel.json` with rewrites configuration |

This is a one-file fix that will resolve the 404 error completely.

