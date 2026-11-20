import React, { useEffect, useRef, useState } from 'react';
import { Languages, LogIn, LogOut, Loader, MessageSquare, X } from 'lucide-react';
import { authError, currentUser, phoneCode, resetPassword, signInWithEmail, signInWithGoogle, signOut, unlinkPhone } from './auth';

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const field = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-ink placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors';

// Sign in or create an account: email and password, or Google. Closing it (X or Esc) carries on as a guest.
export const SignInDialog = ({ onClose }) => {
  const [mode, setMode] = useState('signin'); // or 'signup'
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(null), [error, setError] = useState(null), [notice, setNotice] = useState(null);
  const emailRef = useRef(null);
  useEffect(() => {
    emailRef.current?.focus();
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  const run = async (which, action) => {
    setBusy(which); setError(null); setNotice(null);
    try { await action(); window.location.reload(); } // the app starts over with the account's data
    catch (e) { setError(authError(e)); setBusy(null); }
  };
  const submit = (e) => { e.preventDefault(); run('email', () => signInWithEmail(email.trim(), password, mode === 'signup')); };
  const forgot = async () => {
    setError(null); setNotice(null);
    try { await resetPassword(email.trim()); setNotice(`Password reset link sent to ${email.trim()}`); }
    catch (e) { setError(authError(e)); }
  };
  const signup = mode === 'signup';

  return (
    <div className="fixed inset-0 z-[70] bg-overlay/60 grid place-items-center overflow-y-auto p-4" role="dialog" aria-modal="true" aria-label={signup ? 'Create account' : 'Sign in'}>
      <div className="relative w-full max-w-md my-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-6 sm:p-8">
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 p-2.5 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-800"><X className="w-5 h-5" /></button>
        <div className="flex flex-col items-center">
          <div className="p-2.5 bg-indigo-600 rounded-xl"><Languages className="w-7 h-7 text-on-primary" /></div>
          <h1 className="mt-4 text-[26px] font-semibold text-ink tracking-tight">{signup ? 'Create account' : 'Sign in'}</h1>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 text-center">Close this dialog to continue as a guest for this browser session.</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <label htmlFor="account-email" className="field-label">Email</label>
          <input id="account-email" ref={emailRef} type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <label htmlFor="account-password" className="field-label">Password</label>
          <input id="account-password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="Password" value={password}
                 onChange={(e) => setPassword(e.target.value)} className={field} />
          {!signup && (
            <div className="text-right -mt-1">
              <button type="button" onClick={forgot} className="text-xs text-slate-400 hover:text-ink">Forgot password?</button>
            </div>
          )}
          <button type="submit" disabled={!!busy}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-on-primary font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors">
            {busy === 'email' && <Loader className="w-5 h-5 animate-spin" />}
            {signup ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {error && <p role="alert" className="mt-3 text-sm text-rose-400 text-center">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-emerald-400 text-center">{notice}</p>}
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500"><span className="flex-1 h-px bg-slate-800" />or<span className="flex-1 h-px bg-slate-800" /></div>
        <button onClick={() => run('google', signInWithGoogle)} disabled={!!busy}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-ink font-semibold hover:bg-slate-700 disabled:opacity-60 transition-colors">
          {busy === 'google' ? <Loader className="w-5 h-5 animate-spin" /> : <GoogleLogo />}
          Continue with Google
        </button>
        <p className="mt-6 text-sm text-slate-400 text-center">
          {signup ? 'Already have an account?' : 'No account?'}{' '}
          <button onClick={() => { setMode(signup ? 'signin' : 'signup'); setError(null); setNotice(null); }}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold">{signup ? 'Sign in' : 'Create one'}</button>
        </p>
      </div>
    </div>
  );
};

// For guests, in place of the account button
export const SignInButton = ({ onClick, compact = false }) => (
  <button onClick={onClick} aria-label="Sign in"
          className={compact ? 'p-3 rounded-full bg-slate-800 ring-2 ring-slate-800 text-slate-300 hover:text-ink hover:ring-slate-600'
                             : 'w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold text-slate-400 hover:text-ink hover:bg-slate-800/50 transition-colors'}>
    <LogIn className="w-5 h-5" />
    {!compact && 'Sign in'}
  </button>
);

const Avatar = ({ user, size = 'w-8 h-8' }) => user.photo
  ? <img src={user.photo} alt="" referrerPolicy="no-referrer" className={`${size} rounded-full`} />
  : <span className={`${size} rounded-full bg-indigo-600 text-on-primary grid place-items-center text-sm font-semibold`}>{(user.name || user.email || '?')[0].toUpperCase()}</span>;

// Texting sentences to the Library: link a phone by texting a code to the Twilio number
const SmsSetting = ({ user, onUser }) => {
  const [pending, setPending] = useState(null); // {code, number, minutes}
  useEffect(() => {  // wait for the text to arrive
    if (!pending) return undefined;
    const poll = setInterval(async () => {
      const u = await currentUser().catch(() => null);
      if (u?.phone && u.phone !== user.phone) { onUser(u); setPending(null); }
    }, 3000);
    const expire = setTimeout(() => setPending(null), pending.minutes * 60000);
    return () => { clearInterval(poll); clearTimeout(expire); };
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-4 py-3 border-t border-slate-800">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Text sentences to your Library</div>
      {pending ? (
        <div className="text-sm text-slate-300">
          <div className="flex items-start justify-between gap-2">
            <span>Text this code to <span className="font-mono text-ink">{pending.number}</span></span>
            <button onClick={() => setPending(null)} aria-label="Cancel" className="p-0.5 rounded text-slate-500 hover:text-ink"><X className="w-4 h-4" /></button>
          </div>
          <div className="mt-2 font-mono text-2xl tracking-[0.3em] text-indigo-300">{pending.code}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500"><Loader className="w-3 h-3 animate-spin" />Waiting for your text</div>
        </div>
      ) : user.phone ? (
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-slate-200">{user.phone}</span>
          <button onClick={async () => onUser(await unlinkPhone())} className="text-slate-400 hover:text-rose-400">Unlink</button>
        </div>
      ) : (
        <button onClick={async () => setPending(await phoneCode())}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-ink">
          <MessageSquare className="w-4 h-4" />Link a phone
        </button>
      )}
    </div>
  );
};

// The account button and its settings panel. up: the panel opens above the button (sidebar), else below (phones).
export const AccountMenu = ({ user, onUser, up = true, compact = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)} aria-label="Account" aria-expanded={open}
              className={compact ? 'rounded-full ring-2 ring-slate-800 hover:ring-slate-600'
                                 : 'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-ink hover:bg-slate-800/50 transition-colors'}>
        <Avatar user={user} />
        {!compact && <span className="min-w-0 truncate text-sm font-semibold">{user.name || user.email}</span>}
      </button>
      {open && (
        <div className={`absolute z-50 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden
                         ${up ? 'bottom-full mb-2 left-0' : 'top-full mt-2 right-0'}`}>
          <div className="px-4 py-3 flex items-center gap-3">
            <Avatar user={user} size="w-10 h-10" />
            <div className="min-w-0">
              {user.name && <div className="text-sm font-semibold text-ink truncate">{user.name}</div>}
              <div className="text-xs text-slate-400 truncate">{user.email}</div>
            </div>
          </div>
          {user.twilio_number && <SmsSetting user={user} onUser={onUser} />}
          <button onClick={async () => { await signOut(); window.location.reload(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-slate-800 text-sm text-slate-300 hover:text-ink hover:bg-slate-800/50">
            <LogOut className="w-4 h-4" />Sign out
          </button>
        </div>
      )}
    </div>
  );
};
