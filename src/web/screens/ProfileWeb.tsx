import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { colors } from '../theme';
import { validateName } from '../../lib/validateName';
import { useFontScale, FONT_SCALE_PRESETS, FONT_SCALE_LABELS, FontScaleKey } from '../../lib/fontScale';

const ROLE_LABELS: Record<string, string> = {
  shop: 'Μαγαζί',
  driver: 'Διανομέας',
  owner: 'Διαχειριστής',
  developer: 'Developer',
};

interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

interface Props {
  role: 'owner' | 'shop' | 'driver' | 'developer';
}

export default function ProfileWeb({ role }: Props) {
  const { scaleKey, setScaleKey } = useFontScale();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);

  const hasEditableProfile = role === 'shop' || role === 'driver';

  useEffect(() => { loadProfile(); loadAnnouncements(); }, []);

  async function loadAnnouncements() {
    const { data } = await supabase
      .from('app_announcements')
      .select('*')
      .order('created_at', { ascending: false });
    setAnnouncements((data as any) ?? []);
  }

  async function postAnnouncement() {
    if (!newAnnouncement.trim()) return;
    setPostingAnnouncement(true);
    const { error } = await supabase.from('app_announcements').insert({ message: newAnnouncement.trim() });
    setPostingAnnouncement(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    setNewAnnouncement('');
    loadAnnouncements();
  }

  async function deleteAnnouncement(id: string) {
    if (!window.confirm('Θέλεις σίγουρα να διαγράψεις αυτή την ειδοποίηση;')) return;
    await supabase.from('app_announcements').delete().eq('id', id);
    loadAnnouncements();
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setEmail(user.email ?? '');

    if (role !== 'shop' && role !== 'driver') return;

    const table = role === 'shop' ? 'shops' : 'drivers';
    const { data } = await supabase.from(table).select('name, phone').eq('id', user.id).single();
    if (data) {
      setName((data as any).name ?? '');
      setPhone((data as any).phone ?? '');
    }
  }

  async function saveProfile() {
    const nameError = validateName(name, role as 'shop' | 'driver');
    if (nameError) {
      window.alert(nameError);
      return;
    }
    setSaving(true);
    const table = role === 'shop' ? 'shops' : 'drivers';
    const { error } = await supabase
      .from(table)
      .update({ name: name.trim(), phone: phone.trim() || null })
      .eq('id', userId);
    setSaving(false);
    if (error) window.alert(error.message);
    else window.alert('Τα στοιχεία σου ενημερώθηκαν.');
  }

  async function changePassword() {
    if (newPassword.length < 6) {
      window.alert('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες');
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) window.alert(error.message);
    else {
      setNewPassword('');
      window.alert('Ο κωδικός σου άλλαξε.');
    }
  }

  async function handleSignOut() {
    if (!window.confirm('Είσαι σίγουρος ότι θέλεις να αποσυνδεθείς;')) return;
    setSigningOut(true);
    await supabase.auth.signOut();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520 }}>

      {/* Identity card */}
      <div style={s.identityCard}>
        <span style={s.email}>{email}</span>
        <span style={s.roleBadge}>{ROLE_LABELS[role] ?? role}</span>
      </div>

      {/* Editable info — shop/driver only, mirrors screens/ProfileScreen.tsx (mobile) */}
      {hasEditableProfile && (
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Στοιχεία</h3>

          <label style={s.label}>Όνομα</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)} placeholder="Το όνομα σου" />

          <label style={s.label}>Τηλέφωνο</label>
          <input style={s.input} value={phone} onChange={e => setPhone(e.target.value)} />

          <button
            onClick={saveProfile}
            disabled={saving}
            style={{ ...s.btn, background: colors.primary, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </button>
        </div>
      )}

      {/* Change password */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Αλλαγή Κωδικού</h3>

        <div style={{ position: 'relative' }}>
          <input
            style={{ ...s.input, paddingRight: 40 }}
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Νέος κωδικός (min 6 χαρακτήρες)"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={s.eyeBtn}
            aria-label={showPassword ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>

        <button
          onClick={changePassword}
          disabled={changingPassword || !newPassword}
          style={{
            ...s.btn,
            background: '#A78BFA',
            opacity: changingPassword || !newPassword ? 0.6 : 1,
            marginTop: 14,
          }}
        >
          {changingPassword ? 'Ενημέρωση...' : 'Αλλαγή Κωδικού'}
        </button>
      </div>

      {/* Font size */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Μέγεθος Γραμματοσειράς</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(FONT_SCALE_PRESETS) as FontScaleKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setScaleKey(key)}
              style={{
                ...s.fontScaleChip,
                ...(scaleKey === key ? s.fontScaleChipActive : {}),
              }}
            >
              <span style={{ fontSize: 13 * FONT_SCALE_PRESETS[key], fontWeight: 700, color: scaleKey === key ? colors.primary : colors.textPrimary }}>
                Αα
              </span>
              <span style={{ fontSize: 11, color: scaleKey === key ? colors.primary : colors.textSecondary }}>
                {FONT_SCALE_LABELS[key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* App announcements */}
      <div style={s.section}>
        <h3 style={s.sectionTitle}>Νέα της Εφαρμογής</h3>

        {role === 'developer' && (
          <div style={{ marginBottom: 14 }}>
            <textarea
              style={{ ...s.input, minHeight: 70, resize: 'vertical', fontFamily: 'inherit' }}
              value={newAnnouncement}
              onChange={e => setNewAnnouncement(e.target.value)}
              placeholder="Τι νέο υπάρχει στην εφαρμογή;"
            />
            <button
              onClick={postAnnouncement}
              disabled={postingAnnouncement || !newAnnouncement.trim()}
              style={{ ...s.btn, background: colors.primary, opacity: (postingAnnouncement || !newAnnouncement.trim()) ? 0.6 : 1 }}
            >
              {postingAnnouncement ? 'Δημοσίευση...' : 'Δημοσίευση'}
            </button>
          </div>
        )}

        {announcements.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: 0 }}>Δεν υπάρχουν ειδοποιήσεις ακόμα.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {announcements.map(a => (
              <div key={a.id} style={{ position: 'relative', background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ color: colors.textPrimary, fontSize: 14, lineHeight: 1.5, paddingRight: role === 'developer' ? 24 : 0 }}>{a.message}</div>
                <div style={{ color: colors.textSecondary, fontSize: 11, marginTop: 6 }}>
                  {new Date(a.created_at).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {role === 'developer' && (
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                    title="Διαγραφή"
                  >
                    🗑️
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        style={{ ...s.signOutBtn, opacity: signingOut ? 0.6 : 1 }}
      >
        {signingOut ? 'Αποσύνδεση...' : 'Αποσύνδεση'}
      </button>
    </div>
  );
}

// ── Small inline SVG eye icon — avoids depending on an icon font in the plain-DOM web dashboard ──
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="2" y1="2" x2="22" y2="22" />}
    </svg>
  );
}

const s: Record<string, React.CSSProperties> = {
  identityCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '18px 20px',
  },
  email: { color: colors.textPrimary, fontSize: 15, fontWeight: 600 },
  roleBadge: { color: colors.textSecondary, fontSize: 13 },
  section: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    margin: '0 0 14px',
  },
  label: { fontSize: 13, color: colors.textSecondary, marginBottom: 6, marginTop: 10 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: 14,
    color: colors.textPrimary,
    outline: 'none',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
  },
  btn: {
    marginTop: 16,
    padding: '12px 0',
    borderRadius: 10,
    border: 'none',
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  fontScaleChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 70,
    padding: '10px 0',
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    cursor: 'pointer',
  },
  fontScaleChipActive: {
    borderColor: colors.primary,
    background: colors.primaryHover,
  },
  signOutBtn: {
    padding: '12px 0',
    borderRadius: 10,
    border: '1px solid rgba(239,68,68,0.4)',
    background: 'rgba(239,68,68,0.08)',
    color: colors.error,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
