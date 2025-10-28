# Miko Admin Panel - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Install Dependencies (1 minute)

```bash
# Backend
cd backend
npm install cookie-parser
```

### Step 2: Generate Super Admin Password (1 minute)

```bash
# In backend directory
node scripts/generate-admin-hash.js
```

Follow the interactive prompts:
- Username: `superadmin` (or your choice)
- Password: Create a strong password
- Confirm password

**Copy the output to your `.env` file!**

### Step 3: Configure Environment (30 seconds)

Add to `backend/.env`:

```bash
# Super Admin Configuration
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD_HASH=$2a$12$[YOUR_HASH_HERE]

# JWT Configuration (if not already present)
JWT_SECRET=your-secure-secret-key
ADMIN_JWT_EXPIRES=8h
```

### Step 4: Start Servers (30 seconds)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
# From project root
npm run dev
```

### Step 5: Login and Create First Admin (2 minutes)

1. Open browser: `http://localhost:3000/admin/login`
2. Select **Super Admin** tab
3. Login with your credentials
4. Navigate to **Manage Admins**
5. Click **Create Admin**
6. Create your first Verification Admin

## 🎯 First Verification Admin

**Recommended settings:**
- **Username**: `verifier1` (or any unique name)
- **Password**: Strong password (min 8 chars)
- **Status**: Enabled (default)

## ✅ Verify Installation

### Test Super Admin Access
- [x] Dashboard loads with statistics
- [x] Can create Verification Admin
- [x] Can view all requests
- [x] Can access admin management

### Test Verification Admin Access
- [x] Can login successfully
- [x] Dashboard loads
- [x] Can view verification queue
- [x] Can review pending requests
- [x] Can approve/reject with CCT modification

## 📱 Quick Feature Tour

### For Super Admin

**Dashboard** (`/admin/dashboard`)
- View system statistics
- Quick action links
- Recent activity feed

**Manage Admins** (`/admin/admins`)
- Create new Verification Admins
- Edit credentials
- Enable/disable accounts
- Monitor activity

**All Requests** (`/admin/requests`)
- Complete oversight
- Filter by status
- Audit trail

**Verification** (`/admin/verification`)
- Review pending requests
- Approve with CCT modification
- Reject with reason

### For Verification Admin

**Dashboard** (`/admin/dashboard`)
- Personal statistics
- Quick links to queue

**Verification Queue** (`/admin/verification`)
- List of pending requests
- **Review flow:**
  1. Click "Review" on any request
  2. View user info, location, AI results
  3. See estimated CCT amount
  4. Choose "Approve" or "Reject"
  5. For approval: Modify CCT grant, add notes
  6. For rejection: Provide reason
  7. Confirm decision

**History** (`/admin/history`)
- Your verification decisions
- CCT amounts granted
- Timestamps

## 🔐 Security Checklist

- [ ] Strong Super Admin password set
- [ ] `.env` file not committed to git
- [ ] HTTPS enabled in production
- [ ] JWT_SECRET is random and secure
- [ ] Database connection secured
- [ ] Regular backups configured

## 🐛 Troubleshooting

### Cannot Login
```bash
# Verify env vars are loaded
node -e "console.log(require('dotenv').config())"

# Check if hash was generated correctly
# Password should match what you used in generate script
```

### Page Shows "Loading..."
- Check if backend is running (`http://localhost:5001/api/health`)
- Check browser console for errors
- Verify CORS settings in backend

### Cookie Not Set
- For development: Cookies work without HTTPS
- Check browser DevTools → Application → Cookies
- Ensure `cookie-parser` is installed

### Admin Cannot Access Pages
- Verify admin is enabled in database
- Check if JWT token expired (8 hours)
- Re-login to refresh session

## 📚 Next Steps

1. **Create Multiple Verification Admins**
   - Distribute workload
   - Assign to different regions/teams

2. **Review First Requests**
   - Test the approval workflow
   - Verify CCT modification works
   - Check history logging

3. **Customize Settings**
   - Adjust JWT expiration
   - Configure notification preferences
   - Set up monitoring

4. **Production Deployment**
   - Enable HTTPS
   - Use production database
   - Set secure environment variables
   - Configure backup strategy

## 🔗 Useful Links

- Full Documentation: `/docs/admin-panel.md`
- Implementation Details: `/docs/admin-implementation-summary.md`
- API Reference: See admin-panel.md
- Backend Routes: `/backend/src/routes/admin.routes.js`

## 💡 Pro Tips

1. **Use Strong Passwords**: Minimum 16 characters with mixed case, numbers, symbols
2. **Regular Audits**: Review verification history weekly
3. **Disable Unused Admins**: Better than deleting for audit trail
4. **Backup Credentials**: Store Super Admin password in secure password manager
5. **Monitor Activity**: Check dashboard daily for unusual patterns

## 🆘 Need Help?

1. Check documentation in `/docs/admin-panel.md`
2. Review backend logs for errors
3. Check browser console for frontend issues
4. Verify all environment variables are set
5. Ensure MongoDB connection is working

---

**Setup Complete!** 🎉

You now have a fully functional admin panel with:
- ✅ Secure two-tier authentication
- ✅ Role-based access control
- ✅ Verification workflow with CCT modification
- ✅ Admin management interface
- ✅ Complete audit trail

**Ready to verify your first tree! 🌳**
