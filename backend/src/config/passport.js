import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user.model.js';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback'
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value?.toLowerCase();
      let user = await User.findOne({ 'authMethods.google.googleId': googleId });
      if (user) return done(null, user);
      // Not persisted yet – signal signup
      return done(null, { isNew: true, authMethod: 'google', googleId, email });
    } catch (e) { done(e); }
  }));
} else {
  console.warn('Google OAuth env vars missing; Google login disabled');
}

passport.serializeUser((user, done)=> done(null, user));
passport.deserializeUser((obj, done)=> done(null, obj));

export default passport;
