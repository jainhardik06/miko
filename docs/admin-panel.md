# Miko Admin Panel

## Overview

The Miko Admin Panel is a secure, role-based administration interface for managing tree verification requests and platform administration. It features a unique two-tier authentication system designed specifically for platform security.

## Authentication System

### Two-Tier Architecture

#### 1. Super Admin (Single Account)
- **Credentials**: Stored exclusively in environment variables
- **Username**: `SUPER_ADMIN_USERNAME` (e.g., `superadmin`)
- **Password**: `SUPER_ADMIN_PASSWORD_HASH` (bcrypt hashed)
- **Capabilities**:
  - Full platform oversight
  - Create, edit, disable, and delete Verification Admins
  - View all verification requests (pending, approved, rejected)
  - Access complete system statistics
  - Manage platform settings

#### 2. Verification Admins (Multiple Accounts)
- **Credentials**: Stored in MongoDB database (bcrypt hashed)
- **Created By**: Super Admin only (no self-registration)
- **Capabilities**:
  - Review pending tree verification requests
  - Approve requests with CCT grant modification
  - Reject requests with reason
  - View personal verification history

### Security Features

- **HTTP-Only Cookies**: JWT tokens stored securely
- **Bcrypt Password Hashing**: 12 salt rounds
- **Session Management**: 8-hour token expiration
- **No Password Reset**: Admin credentials managed by Super Admin
- **No Social Logins**: Purpose-built authentication only

## Setup

### 1. Generate Super Admin Password Hash

```bash
# Using Node.js
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_SECURE_PASSWORD', 12));"
```

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Super Admin Configuration
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PASSWORD_HASH=$2a$12$YOUR_GENERATED_HASH_HERE

# JWT Configuration
JWT_SECRET=your-secure-jwt-secret
ADMIN_JWT_EXPIRES=8h
```

### 3. Install Backend Dependencies

```bash
cd backend
npm install cookie-parser
```

### 4. Start the Backend

```bash
cd backend
npm run dev
```

### 5. Access the Admin Panel

Navigate to: `http://localhost:3000/admin/login`

## Features by Role

### Super Admin Dashboard

**URL**: `/admin/dashboard`

**Features**:
- System statistics overview
- Recent activity feed
- Quick action links
- Admin management access

**Admin Management** (`/admin/admins`):
- Create new Verification Admins
- Edit admin credentials (username, password)
- Enable/disable admin accounts
- Delete admin accounts
- View verification counts and activity

**All Requests** (`/admin/requests`):
- View all verification requests
- Filter by status (Pending, Approved, Rejected)
- Complete oversight and audit trail

### Verification Admin Dashboard

**URL**: `/admin/dashboard`

**Features**:
- Pending requests count
- Personal statistics
- Quick access to verification queue

**Verification Queue** (`/admin/verification`):
- List of pending verification requests
- Detailed request review interface
- User information and location data
- AI verification results display
- **CCT Grant Modification**: 
  - View AI-estimated CCT amount
  - Modify CCT grant before approval
  - Add optional approval notes
- Rejection with reason

**Verification History** (`/admin/history`):
- Personal verification decisions
- Approval/rejection record
- CCT amounts granted
- Timestamps and request IDs

## API Endpoints

### Authentication

```
POST /api/admin/auth/super-admin/login
POST /api/admin/auth/verification-admin/login
POST /api/admin/auth/logout
GET  /api/admin/auth/me
```

### Super Admin: Verification Admin Management

```
POST   /api/admin/verification-admins
GET    /api/admin/verification-admins
GET    /api/admin/verification-admins/:id
PATCH  /api/admin/verification-admins/:id
DELETE /api/admin/verification-admins/:id
```

### Dashboard & Stats

```
GET /api/admin/dashboard/stats
```

### Verification Workflow

```
GET  /api/admin/verification/queue
GET  /api/admin/verification/requests/:id
POST /api/admin/verification/requests/:id/approve
POST /api/admin/verification/requests/:id/reject
GET  /api/admin/verification/history
GET  /api/admin/verification/all-requests  (Super Admin only)
```

## Database Schema

### VerificationAdmin Model

```javascript
{
  username: String (unique, required),
  passwordHash: String (required),
  isEnabled: Boolean (default: true),
  createdBy: String (default: 'super-admin'),
  lastLogin: Date,
  verificationHistory: [{
    requestId: ObjectId,
    action: 'APPROVED' | 'REJECTED',
    timestamp: Date,
    cctGranted: Number
  }],
  timestamps: true
}
```

### TreeSubmission Model (Updated)

```javascript
{
  // ... existing fields
  reviewedBy: String,  // Admin username or ID
  reviewedAt: Date,
  reviewNotes: String,
  cctGranted: Number  // CCT amount granted on approval
}
```

## CCT Grant Workflow

1. User submits tree registration request
2. AI service analyzes and estimates CCT value
3. Request enters PENDING state
4. Verification Admin reviews request:
   - Views user info, location, AI results
   - Sees AI-estimated CCT amount
   - Can modify CCT grant based on manual review
   - Adds optional notes
   - Approves with final CCT amount
5. System records decision and CCT grant
6. (Future) On-chain minting triggered with granted CCT

## Security Best Practices

### For Super Admin

1. **Strong Password**: Use a complex password (20+ characters recommended)
2. **Secure Storage**: Store environment variables securely
3. **Regular Audits**: Review Verification Admin activity regularly
4. **Disable Unused**: Disable rather than delete admins for audit trail

### For Verification Admins

1. **Unique Credentials**: Each admin has unique username and password
2. **Regular Review**: Super Admin should review verification patterns
3. **Accountability**: All actions logged with admin identification

### Production Deployment

1. **HTTPS Only**: Enforce secure cookie transmission
2. **Environment Variables**: Never commit credentials to git
3. **Rotate Secrets**: Periodically update JWT_SECRET
4. **Monitor Sessions**: Track unusual login patterns
5. **Backup Database**: Regular backups of admin credentials

## Troubleshooting

### Cannot Login as Super Admin

```bash
# Verify environment variables are loaded
echo $SUPER_ADMIN_USERNAME
echo $SUPER_ADMIN_PASSWORD_HASH

# Regenerate password hash if needed
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_PASSWORD', 12));"
```

### Cookie Not Set

- Check `NODE_ENV` and `secure` flag settings
- For development, cookies work without HTTPS
- For production, ensure HTTPS is enabled

### Verification Admin Cannot Login

- Check if account is enabled: Super Admin → Manage Admins
- Verify password was set correctly
- Check database connection

## Future Enhancements

- [ ] Multi-signature approval workflow (require 2+ admins)
- [ ] Advanced analytics and reporting
- [ ] IP whitelist for Super Admin access
- [ ] Two-factor authentication (2FA)
- [ ] Audit log export functionality
- [ ] Real-time notifications for new requests
- [ ] Bulk operations for request management

## Support

For issues or questions about the admin panel:
1. Check this README
2. Review backend logs: `backend/logs`
3. Check browser console for frontend errors
4. Verify database connectivity

---

**Version**: 1.0.0  
**Last Updated**: October 28, 2025
