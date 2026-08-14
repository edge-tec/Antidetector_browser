# 🚀 ProfileVault — Centralized aaPanel Production Deployment & Administration Guide

This guide details how to host, configure, and manage your centralized **ProfileVault Anti-Detect Browser Platform** backend, REST APIs, database, landing page, and desktop release downloads on **aaPanel**.

---

## 🏗️ System Architecture Overview

```
                        aaPanel Server Infrastructure
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
     Web Admin Dashboard                              Centralized REST API
 (Users, Plans, Releases, CMS)                     (Auth, License, Downloads)
              │                                               │
       ┌──────┼───────┐                                       │
       │      │       │                                       │
     Users  Plans  Downloads                                  │
       │      │       │                                       │
       └──────┼───────┘                                       │
              │                                               │
         Landing Page ────────────────────────────────────────┘
              │
        Windows / macOS / Linux
         Desktop Applications
              │
              ▼
       Login + License Auth
              │
              ▼
    Server-Side Permissions & Expiration Validation
```

---

## 💻 Step-by-Step aaPanel Deployment Process

### Step 1: Create Website & Domain in aaPanel
1. Log into your **aaPanel Control Panel**.
2. Go to **Website** → **Add Site**.
3. Enter your production domain (e.g. `your-domain.com`).
4. Set **PHP Version** to `PureStatic` or any version (we will use Nginx Reverse Proxy to Node.js).
5. Click **Submit**.

---

### Step 2: Install Node.js & PM2 Manager in aaPanel
1. In aaPanel, go to **App Store**.
2. Search for **PM2 Manager** and click **Install**.
3. Open **PM2 Manager** → **Node Version** → Select & Install **Node.js v18** or **v20 LTS**.

---

### Step 3: Configure SSL/HTTPS in aaPanel
1. Go to **Website** → Click on your site (`your-domain.com`).
2. Navigate to **SSL** tab.
3. Select **Let's Encrypt** → Check your domain name → Click **Apply**.
4. Enable **Force HTTPS** toggle switch on the top right.

---

### Step 4: Configure Nginx Reverse Proxy in aaPanel
1. In Website Settings, go to **Reverse Proxy** → **Add reverse proxy**.
2. Set **Proxy Name**: `ProfileVault_Backend`.
3. Set **Target URL**: `http://127.0.0.1:3000`.
4. Click **Save**.
5. Alternatively, edit the Nginx configuration file directly using the provided `aaPanel-deployment/nginx.conf` template.

---

### Step 5: Upload Project Files & Deploy
1. Open aaPanel **Files** manager or connect via SSH.
2. Upload the project folder to `/www/wwwroot/your-domain.com`.
3. Open aaPanel Terminal or SSH:
   ```bash
   cd /www/wwwroot/your-domain.com
   bash aaPanel-deployment/deploy.sh
   ```
4. PM2 will automatically start `profilevault-server` listening on port `3000`.

---

## 🔐 10 Key Management Capabilities Controlled from aaPanel Server

### 1. User Management
Administrators can log into `https://your-domain.com` with admin credentials to access **Admin Panel**:
- **View & Search Users**: Instant search by name, email, or role filter (`Admin` vs `User`).
- **Create Users**: Add new team or client accounts directly from the server.
- **Edit & Suspend Users**: Instantly change user status (`Active`, `Pending`, `Suspended`). When suspended, the server immediately denies access to all desktop browser profiles.
- **Reset Password**: Reset user passwords securely from the server.

---

### 2. Subscription & Expiration Management
- **Plan Pricing & Limits**: Admin can modify monthly/yearly price, profile limit (e.g., 25, 100, 500 profiles), and team user limits.
- **Set Expiration Date**: Admin can extend or set exact subscription expiration dates.
- **Real-Time Expiration Enforcement**: When a subscription expires, the server returns `subscription_status: "expired"` during license validation, automatically restricting desktop application profile launches until renewed.

---

### 3. Application Downloads Management
Under **Admin Panel** → **Application Downloads**:
- **Windows (.exe)**: Set download URL, current version (`1.0.0`), min supported version, and toggle enable/disable.
- **macOS Apple Silicon / Intel (.dmg)**: Set macOS download URL, current version, release notes, and force update settings.
- **Linux (.AppImage)**: Set Linux download URL and version.
- **Dynamic Display**: The Landing Page automatically pulls these download URLs dynamically from the database without requiring code changes.

---

### 4. Database-Driven Landing Page CMS
Manage all landing page elements directly from the database/admin UI:
- **Branding**: Site name, logo image, primary/accent colors, support email, social links.
- **Hero & Content**: Headline, subheadline, trust text, feature grids, pricing tables, FAQs, testimonials, and SEO meta tags.

---

### 5. Desktop Application Server-Side Integration
When a user launches the desktop app:
1. Desktop app sends `POST /api/license/validate` with `sessionToken`, `installationId`, `platform`, and `appVersion`.
2. Server validates user account status, subscription expiration, and active device count against `max_devices_limit`.
3. Server returns authoritative feature permissions (`browser_profiles`, `advanced_fingerprint`, `proxy_manager`, `team_management`, `api_access`).
