# OpenClaw Enterprise Browser-Only Onboarding Guide (No Command Line)

This guide is for a non-technical user. You only need a web browser on your local machine.

## What you can do with this guide

- Sign up or accept an invite
- Log in
- Set up your OpenClaw account/workspace
- Connect channels (WhatsApp, Telegram, Slack, and others available in your environment)
- Install and configure skills
- Send your first message and verify OpenClaw is working

## Before you start

You should have these from your OpenClaw Enterprise administrator:

- Local web URL for enterprise portal (usually `http://localhost:18788/`)
- A signup-enabled environment **or** an invite link/email
- (If required) initial workspace/tenant name guidance
- Channel credentials (for example Telegram bot token or Slack app permissions)

If you do not have these, contact your administrator first.

---

## 1) Open the local browser portal

1. Open your browser.
2. Go to: `http://localhost:18788/`.
3. You should see **OpenClaw Enterprise Onboarding Portal**.

If you open `http://localhost:18789/`, that is the original gateway UI and not the enterprise onboarding portal.

---

## 2) Create your account (two supported paths)

### Path A: Self-serve signup

If your environment allows self-signup:

1. In panel **1) Sign up**, enter email + display name.
2. Click **Create account**.
3. Copy/keep the returned `userId` (the form auto-fills later steps).
4. In panel **2) Login (OIDC)** click **Start login**.

### Path B: Invite-only activation

If your organization uses invites:

1. Get the invite token from your admin.
2. In panel **3) Accept invite**, enter token, email, and display name.
3. Click **Accept invite**.
4. Then run **Start login** in panel **2) Login (OIDC)**.

If you do not see self-signup and have no invite, ask your admin to invite you.

---

## 3) Complete first-time account setup

Use panel **4) Account bootstrap**:

1. Confirm `userId` is present.
2. Enter `tenantId` and optional `workspaceId`.
3. Choose profile (`starter` or `regulated`).
4. Click **Bootstrap account**.
5. Click **Mark setup complete** once channels + skills are done.

Do not close the browser until bootstrap and setup complete calls succeed.

---

## 4) Connect channels

Open the **Channels** section in the browser UI.

### WhatsApp

1. Choose **WhatsApp**.
2. Click **Load channel catalog**.
3. Select `whatsapp`.
4. Enter account label and click **Create connection**.
5. Click **Verify connection**.

### Telegram

1. Choose **Telegram**.
2. Select `telegram`.
3. Enter account label.
4. Click **Create connection** then **Verify connection**.

### Slack

1. Choose **Slack**.
2. Select `slack`.
3. Create and verify the connection in the panel.

### Other channels

For other channels listed in your UI:

1. Open the channel card.
2. Fill required fields.
3. Run **Verify connection**.
4. Confirm status is **Verified**.

---

## 5) Install and configure skills

Open the **Skills** section.

1. Click **Load skills catalog**.
2. Select a skill.
3. Click **Install skill**.
4. Set optional env lines (`KEY=VALUE`) and click **Save skill config**.

If a skill shows missing requirements, complete those fields and retry.

---

## 6) Finish setup

1. Return to the onboarding checklist (if still visible).
2. Confirm all required items are marked complete:
   - account
   - at least one channel
   - at least one skill
3. Click **Complete setup**.

You are now ready to use OpenClaw.

---

## 7) Send your first message

### From the web UI

1. Open Chat.
2. Send: `Hello OpenClaw`.
3. Confirm you receive a reply.

### From a connected channel

1. Open your connected channel client (WhatsApp/Telegram/Slack).
2. Send a message to your OpenClaw bot/account.
3. Confirm reply is received in that channel.

### Test a skill

In chat, run a skill command (if enabled), for example:

- `/skill <skill-name> test`

Confirm the skill runs and returns output.

---

## 8) Quick troubleshooting (no command line)

If something is not working:

1. Refresh browser and sign in again.
2. Check channel status in **Channels** (must be Connected/Verified).
3. Check skill status in **Skills** (must be Enabled).
4. Re-run channel verification in the channel card.
5. If still blocked, share a screenshot of the error with your administrator.

---

## 9) Success checklist

You are fully onboarded when all are true:

- You can complete login from browser at `http://localhost:18788/`
- Your workspace/account setup is complete
- At least one channel is connected and verified
- At least one skill is installed and enabled
- You can send and receive a message in web UI or channel client
