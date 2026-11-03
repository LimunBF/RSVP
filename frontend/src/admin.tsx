import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, Copy, Download, ExternalLink, ImagePlus, LogOut, Menu, Pencil, Plus, Search, ShieldAlert, Trash2, Upload, UserCheck, Users, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api, assetUrl, clock, couple, dateInput, fullDate, type CheckInToken, type RSVP, type RSVPList, type SearchResult, type SessionStats, type Stats, type Wedding } from './api';
import { Alert, Btn, Card, Field, Ornament, Spinner, type Notice } from './ui';

type WeddingValues = { bride: string; groom: string; slug: string; event_date: string; deadline: string; location: string; story: string; cover_url: string };
const EMPTY_STATS: Stats = { total: 0, yes: 0, no: 0, maybe: 0, guests: 0, checkin: 0 };

// QR code rendered as a downloadable PNG so organizers can print a poster for the entrance table.
function QrCard({ url, title, hint }: { url: string; title: string; hint: string }) {
  const [svg, setSvg] = useState<string>('');
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setSvg(ref.current?.querySelector('svg')?.outerHTML || ''); }, [url]);
  const download = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <div>
    <div ref={ref}><QRCodeSVG value={url} size={128}/></div>
    <strong>{title}</strong><small>{hint}</small>
    <button className="qr-download" onClick={download}><Download size={14}/> Unduh QR</button>
  </div>;
}

function Auth({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate();
  const [notice, setNotice] = useState<Notice>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ name: string; email: string; password: string; confirmation: string }>();
  return <main className="auth-page">
    <Link className="brand" to="/login">Sowan.</Link>
    <Card>
      <p className="app-kicker">Organizer</p>
      <h1>{mode === 'register' ? 'Buat akun' : 'Selamat datang kembali'}</h1>
      <p>Kelola undangan dan kehadiran tamu dalam satu tempat.</p>
      <form className="app-form" noValidate onSubmit={handleSubmit(async values => {
        setNotice(null);
        if (mode === 'register' && values.password !== values.confirmation) { setNotice({ kind: 'error', text: 'Konfirmasi kata sandi tidak sama' }); return; }
        try { const result = await api.post<{ token: string }>(`/auth/${mode}`, values); localStorage.setItem('rsvp-token', result.token); nav('/dashboard'); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal masuk' }); }
      })}>
        {mode === 'register' && <label>Nama<input aria-invalid={Boolean(errors.name)} {...register('name', { required: 'Nama wajib diisi' })}/>{errors.name && <small className="field-error" role="alert">{errors.name.message}</small>}</label>}
        <label>Email<input type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...register('email', { required: 'Email wajib diisi', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Format email belum benar' } })}/>{errors.email && <small className="field-error" role="alert">{errors.email.message}</small>}</label>
        <label>Kata sandi<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} {...register('password', { required: 'Kata sandi wajib diisi', minLength: { value: 8, message: 'Minimal 8 karakter' } })}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div>{errors.password && <small className="field-error" role="alert">{errors.password.message}</small>}</label>
        {mode === 'register' && <label>Ulangi kata sandi<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.confirmation)} {...register('confirmation', { required: 'Ulangi kata sandi' })}/>{errors.confirmation && <small className="field-error" role="alert">{errors.confirmation.message}</small>}</label>}
        <Alert notice={notice}/>
        <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Memproses...' : mode === 'register' ? 'Daftar' : 'Masuk'}</Btn>
      </form>
      <p className="auth-switch"><Link to={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</Link></p>
    </Card>
  </main>;
}

function WeddingForm({ token, wedding, done, cancel, unauthorized }: { token: string; wedding?: Wedding; done: (message: string) => void; cancel: () => void; unauthorized: () => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<WeddingValues>({
    defaultValues: wedding ? { bride: wedding.bride, groom: wedding.groom, slug: wedding.slug, event_date: dateInput(wedding.event_date), deadline: wedding.deadline ? dateInput(wedding.deadline) : '', location: wedding.location, story: wedding.story, cover_url: wedding.cover_url.startsWith('http') ? wedding.cover_url : '' } : {},
  });
  return <Card className="editor-card">
    <div className="card-heading"><div><p className="app-kicker">{wedding ? 'Edit acara' : 'Acara baru'}</p><h2>{wedding ? couple(wedding) : 'Buat undangan'}</h2></div><button className="icon-btn" onClick={cancel} aria-label="Tutup form"><X/></button></div>
    <form className="grid-form" noValidate onSubmit={handleSubmit(async values => {
      setNotice(null);
      try {
        if (wedding) await api.put(`/api/weddings/${wedding.id}`, values, token);
        else await api.post('/api/weddings', values, token);
        done(wedding ? 'Perubahan acara disimpan.' : 'Acara baru berhasil dibuat.');
      } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') unauthorized();
        else setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menyimpan acara' });
      }
    })}>
      <Field label="Mempelai wanita" hint="Nama yang tampil pertama di undangan" error={errors.bride?.message}><input aria-invalid={Boolean(errors.bride)} {...register('bride', { required: 'Wajib diisi' })}/></Field>
      <Field label="Mempelai pria" hint="Nama yang tampil kedua di undangan" error={errors.groom?.message}><input aria-invalid={Boolean(errors.groom)} {...register('groom', { required: 'Wajib diisi' })}/></Field>
      <Field label="Slug tautan" hint="Huruf kecil, angka, dan tanda minus. Contoh: anisa-bima" error={errors.slug?.message}><input aria-invalid={Boolean(errors.slug)} {...register('slug', { required: 'Wajib diisi', pattern: { value: /^[a-z0-9-]+$/, message: 'Hanya huruf kecil, angka, dan tanda minus' } })}/></Field>
      <Field label="Tanggal acara" hint="Dipakai untuk countdown dan tautan kalender" error={errors.event_date?.message}><input type="date" aria-invalid={Boolean(errors.event_date)} {...register('event_date', { required: 'Wajib diisi' })}/></Field>
      <Field label="Batas RSVP" hint="Opsional. Setelah tanggal ini RSVP ditutup otomatis"><input type="date" {...register('deadline')}/></Field>
      <Field label="Lokasi" hint="Nama gedung dan alamat singkat, dipakai untuk Google Maps" error={errors.location?.message}><input aria-invalid={Boolean(errors.location)} {...register('location', { required: 'Wajib diisi' })}/></Field>
      <Field label="Cover URL cadangan" hint="Opsional. Upload foto di panel Foto undangan lebih disarankan" wide><input type="url" {...register('cover_url')}/></Field>
      <Field label="Cerita pasangan" hint="Maksimal 3000 karakter. Tampil di bagian profil mempelai" wide><textarea rows={5} maxLength={3000} {...register('story')}/></Field>
      <Alert notice={notice}/>
      <div className="form-actions"><Btn type="button" className="outline-btn" onClick={cancel}>Batal</Btn><Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan acara'}</Btn></div>
    </form>
  </Card>;
}

function Sessions({ wedding, token, reload, toast, unauthorized }: { wedding: Wedding; token: string; reload: () => Promise<void>; toast: (text: string) => void; unauthorized: () => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{ label: string; start_time: string; end_time: string }>();
  const guard = (error: unknown, fallback: string) => {
    if (error instanceof Error && error.message === 'Unauthorized') unauthorized();
    else setNotice({ kind: 'error', text: error instanceof Error ? error.message : fallback });
  };
  return <div className="dashboard-section">
    <div className="section-title"><div><h2>Sesi acara</h2><p>Atur akad, resepsi, atau sesi tamu. Maksimal tiga sesi.</p></div></div>
    <ul className="sessions">{wedding.sessions.map(session => <li key={session.id}>
      <span><strong>{session.label}</strong><small>{new Date(session.start_time).toLocaleString('id-ID')} — {clock(session.end_time)} WIB</small></span>
      <button className="icon-btn" aria-label={`Hapus ${session.label}`} onClick={async () => {
        if (!confirm(`Hapus sesi ${session.label}?`)) return;
        try { await api.del(`/api/weddings/${wedding.id}/sessions/${session.id}`, token); await reload(); toast('Sesi berhasil dihapus.'); }
        catch (error) { guard(error, 'Gagal menghapus sesi'); }
      }}><Trash2 size={17}/></button>
    </li>)}</ul>
    {wedding.sessions.length < 3 && <form className="session-form" noValidate onSubmit={handleSubmit(async values => {
      setNotice(null);
      try { await api.post(`/api/weddings/${wedding.id}/sessions`, values, token); reset(); await reload(); toast('Sesi berhasil ditambahkan.'); }
      catch (error) { guard(error, 'Gagal menambah sesi'); }
    })}>
      <Field label="Nama sesi" hint="Contoh: Akad Nikah" error={errors.label?.message}><input placeholder="Akad Nikah" aria-invalid={Boolean(errors.label)} {...register('label', { required: 'Wajib diisi' })}/></Field>
      <Field label="Waktu mulai" error={errors.start_time?.message}><input type="datetime-local" aria-invalid={Boolean(errors.start_time)} {...register('start_time', { required: 'Wajib diisi' })}/></Field>
      <Field label="Waktu selesai" error={errors.end_time?.message}><input type="datetime-local" aria-invalid={Boolean(errors.end_time)} {...register('end_time', { required: 'Wajib diisi' })}/></Field>
      <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Menambahkan...' : 'Tambah sesi'}</Btn>
    </form>}
    <Alert notice={notice}/>
  </div>;
}

function MediaManager({ wedding, token, reload, toast, unauthorized }: { wedding: Wedding; token: string; reload: () => Promise<void>; toast: (text: string) => void; unauthorized: () => void }) {
  const [kind, setKind] = useState<'cover' | 'gallery'>('gallery');
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState('');
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setNotice({ kind: 'error', text: 'Pilih foto terlebih dahulu.' }); return; }
    if (file.size > 8 * 1024 * 1024) { setNotice({ kind: 'error', text: 'Ukuran foto melebihi 8 MB.' }); return; }
    setBusy(true); setNotice(null);
    const form = new FormData();
    form.append('kind', kind); form.append('file', file); form.append('alt_text', alt);
    try {
      await api.upload(`/api/weddings/${wedding.id}/images`, form, token);
      setFile(undefined); setAlt(''); await reload();
      toast(kind === 'cover' ? 'Cover berhasil diganti.' : 'Foto galeri berhasil ditambahkan.');
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') unauthorized();
      else setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Upload gagal' });
    }
    finally { setBusy(false); }
  };
  return <div className="dashboard-section">
    <div className="section-title"><div><h2>Foto undangan</h2><p>JPG, PNG, atau WebP, maksimal 8 MB. File tersimpan di folder acara ini.</p></div><ImagePlus/></div>
    <form className="upload-form" onSubmit={upload}>
      <Field label="Jenis foto"><select value={kind} onChange={event => setKind(event.target.value as 'cover' | 'gallery')}><option value="cover">Cover utama</option><option value="gallery">Galeri</option></select></Field>
      <Field label="Pilih foto"><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Pilih foto" onChange={event => setFile(event.target.files?.[0])}/></Field>
      <Field label="Deskripsi foto" hint="Membantu pembaca layar memahami isi foto"><input value={alt} onChange={event => setAlt(event.target.value)} placeholder="Anisa dan Bima di taman"/></Field>
      {preview && <figure className="upload-preview"><img src={preview} alt="Pratinjau foto yang akan diunggah"/><figcaption>Pratinjau sebelum upload</figcaption></figure>}
      <Btn className="ink" disabled={busy}><Upload size={18}/>{busy ? 'Mengunggah...' : 'Upload foto'}</Btn>
    </form>
    <Alert notice={notice}/>
    <div className="media-grid">{wedding.images.length === 0 ? <p className="empty-inline">Belum ada foto upload. Undangan memakai cover URL atau gambar contoh.</p> : wedding.images.map(image => <figure key={image.id}>
      <img src={assetUrl(image.path)} alt={image.alt_text || image.original_name}/>
      <figcaption><span>{image.kind === 'cover' ? 'Cover' : 'Galeri'}</span><button aria-label={`Hapus ${image.original_name}`} onClick={async () => {
        if (!confirm('Hapus foto ini?')) return;
        try { await api.del(`/api/weddings/${wedding.id}/images/${image.id}`, token); await reload(); toast('Foto berhasil dihapus.'); }
        catch (error) {
          if (error instanceof Error && error.message === 'Unauthorized') unauthorized();
          else setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menghapus foto' });
        }
      }}><Trash2 size={16}/></button></figcaption>
    </figure>)}</div>
  </div>;
}

function Dashboard() {
  const nav = useNavigate();
  const token = localStorage.getItem('rsvp-token');
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [selected, setSelected] = useState<Wedding>();
  const [rows, setRows] = useState<RSVP[]>([]);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [sessionStats, setSessionStats] = useState<SessionStats[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [toast, setToast] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestQuery, setGuestQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const [checkInPath, setCheckInPath] = useState('');

  // An expired token must land the organizer back on login, not on a dead dashboard.
  const unauthorized = () => { localStorage.removeItem('rsvp-token'); nav('/login'); };
  const fail = (error: unknown) => {
    if (error instanceof Error && error.message === 'Unauthorized') unauthorized();
    else setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Terjadi kesalahan' });
  };

  const load = async () => {
    if (!token) return;
    const data = await api.get<Wedding[]>('/api/weddings', token);
    setWeddings(data);
    setSelected(current => data.find(item => item.id === current?.id) || data[0]);
  };
  const loadRows = async (id = selected?.id) => {
    if (!id || !token) return;
    const result = await api.get<RSVPList>(`/api/weddings/${id}/rsvps`, token);
    setRows(result.rsvps); setStats(result.stats); setSessionStats(result.sessions || []);
  };
  const refresh = async () => { await load(); await loadRows(); };
  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 3200); };

  useEffect(() => { if (!token) nav('/login'); else load().catch(fail).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selected && token) loadRows(selected.id).catch(fail); }, [selected?.id]);
  useEffect(() => {
    if (!selected || !token) { setCheckInPath(''); return; }
    api.get<CheckInToken>(`/api/weddings/${selected.id}/check-in-token`, token).then(data => setCheckInPath(data.path)).catch(() => setCheckInPath(''));
  }, [selected?.id]);
  if (!token) return null;

  const invitationUrl = `${location.origin}/w/${selected?.slug || ''}`;
  const checkInUrl = checkInPath ? `${location.origin}${checkInPath}` : '';
  const visibleRows = rows.filter(row => row.name.toLowerCase().includes(guestQuery.toLowerCase()));
  const attending = rows.filter(row => row.attendance === 'yes').length;

  return <main className="dashboard">
    <aside className={navOpen ? 'open' : ''}>
      <div className="aside-head">
        <Link className="brand" to="/dashboard">Sowan.</Link>
        <button className="nav-toggle" onClick={() => setNavOpen(open => !open)} aria-expanded={navOpen} aria-label={navOpen ? 'Tutup daftar acara' : 'Buka daftar acara'}>{navOpen ? <X/> : <Menu/>}</button>
      </div>
      <nav aria-label="Daftar acara">{weddings.map(wedding => <button className={selected?.id === wedding.id ? 'active' : ''} key={wedding.id} onClick={() => { setSelected(wedding); setEditing(false); setCreating(false); setNavOpen(false); }}>{couple(wedding)}</button>)}</nav>
      <Btn className="plain" onClick={() => { localStorage.removeItem('rsvp-token'); nav('/login'); }}><LogOut size={18}/> Keluar</Btn>
    </aside>
    <section className="dashboard-main">
      <header>
        <div><p className="app-kicker">Pusat kendali acara</p><h1>{selected ? couple(selected) : 'Undangan'}</h1></div>
        <div className="header-actions">
          {selected && <Btn className="outline-btn" onClick={() => { setEditing(true); setCreating(false); }}><Pencil size={18}/> Edit acara</Btn>}
          <Btn className="ink" onClick={() => { setCreating(true); setEditing(false); }}><Plus size={18}/> Buat acara</Btn>
        </div>
      </header>
      <Alert notice={notice}/>
      <AnimatePresence>{toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><Check size={18}/>{toast}</motion.div>}</AnimatePresence>
      {loading ? <Spinner label="Memuat dashboard..."/> : <>
        {creating && <WeddingForm token={token} cancel={() => setCreating(false)} unauthorized={unauthorized} done={async message => { setCreating(false); await load(); showToast(message); }}/>}
        {editing && selected && <WeddingForm token={token} wedding={selected} cancel={() => setEditing(false)} unauthorized={unauthorized} done={async message => { setEditing(false); await load(); showToast(message); }}/>}
        {!selected && !creating && <Card className="empty-state"><Plus/><h2>Belum ada acara</h2><p>Buat acara pertama untuk mendapatkan halaman undangan, QR, dan daftar RSVP.</p><Btn className="ink" onClick={() => setCreating(true)}>Buat acara pertama</Btn></Card>}
        {selected && !creating && !editing && <>
          <section className="summary">
            <Card><Users/><strong>{stats.total}</strong><span>RSVP masuk</span></Card>
            <Card><Check/><strong>{stats.guests}</strong><span>Tamu terkonfirmasi</span></Card>
            <Card><UserCheck/><strong>{stats.checkin}</strong><span>Sudah check-in</span></Card>
            <Card><strong>{stats.maybe}</strong><span>Masih mungkin</span></Card>
            <Card><strong>{stats.no}</strong><span>Tidak hadir</span></Card>
          </section>
          {sessionStats.length > 1 && <section className="session-summary">
            {sessionStats.map(session => <Card key={session.id}>
              <p className="app-kicker">{session.label}</p>
              <strong>{session.guests}</strong><span>tamu terkonfirmasi</span>
              <small>{session.rsvps} RSVP · {session.checkin} check-in</small>
            </Card>)}
          </section>}
          <section className="dashboard-layout">
            <Card className="event-control">
              <div className="card-heading"><div><p className="app-kicker">Tautan acara</p><h2>{couple(selected)}</h2></div><a className="preview-link" href={invitationUrl} target="_blank" rel="noreferrer">Lihat undangan <ExternalLink size={16}/></a></div>
              <p>{selected.location}</p>
              {selected.deadline && <p className="deadline-line">Batas RSVP: {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date(selected.deadline))}</p>}
              <div className="link-box"><div><small>Undangan</small><code>{invitationUrl}</code></div><button onClick={async () => { await navigator.clipboard.writeText(invitationUrl); showToast('Tautan undangan disalin.'); }}><Copy size={16}/> Salin</button></div>
              <div className="qr-pair">
                <QrCard url={invitationUrl} title="QR Undangan" hint="Membuka undangan untuk tamu"/>
                {checkInUrl ? <QrCard url={checkInUrl} title="QR Check-in" hint="Poster meja tamu. Hanya QR ini yang bisa membuka absensi."/> : <div className="qr-warning"><ShieldAlert/><strong>QR Check-in belum siap</strong><small>Muat ulang dashboard untuk membuat tautan absensi.</small></div>}
              </div>
              <Sessions wedding={selected} token={token} reload={refresh} toast={showToast} unauthorized={unauthorized}/>
              <MediaManager wedding={selected} token={token} reload={refresh} toast={showToast} unauthorized={unauthorized}/>
            </Card>
            <Card className="guest-card">
              <div className="card-heading"><div><p className="app-kicker">Operasional tamu</p><h2>Daftar hadir</h2></div><span className={`attendance-count ${attending === 0 ? 'idle' : ''}`}>{stats.checkin}/{attending} check-in</span></div>
              <label className="search-field"><Search size={18}/><input value={guestQuery} onChange={event => setGuestQuery(event.target.value)} placeholder="Cari nama tamu" aria-label="Cari nama tamu"/></label>
              {rows.length === 0 ? <div className="empty-inline"><Users/><p>Belum ada RSVP masuk.</p><a className="text-action" href={invitationUrl} target="_blank" rel="noreferrer">Salin tautan undangan untuk dibagikan</a></div> : <div className="table-wrap">
                <table>
                  <thead><tr><th>Nama</th><th>Status RSVP</th><th>Sesi</th><th>Tamu</th><th>Absensi</th></tr></thead>
                  <tbody>{visibleRows.map(row => <tr key={row.id}>
                    <td data-label="Nama"><strong>{row.name}</strong>{row.message && <small>{row.message}</small>}</td>
                    <td data-label="Status RSVP"><span className={`status ${row.attendance}`}>{row.attendance === 'yes' ? 'Hadir' : row.attendance === 'maybe' ? 'Mungkin' : 'Tidak hadir'}</span></td>
                    <td data-label="Sesi">{row.session?.label || '-'}</td>
                    <td data-label="Tamu">{row.guests_count}</td>
                    <td data-label="Absensi">{row.attendance !== 'yes' ? '-' : <button className={`check-button ${row.checked_in_at ? 'checked' : ''}`} onClick={async () => {
                      try {
                        if (row.checked_in_at) await api.del(`/api/weddings/${selected.id}/rsvps/${row.id}/check-in`, token);
                        else await api.post(`/api/weddings/${selected.id}/rsvps/${row.id}/check-in`, {}, token);
                        await loadRows(selected.id);
                        showToast(row.checked_in_at ? 'Check-in dibatalkan.' : `${row.name} berhasil check-in.`);
                      } catch (error) { fail(error); }
                    }}>{row.checked_in_at ? <><Check size={16}/> Sudah hadir</> : 'Check-in'}</button>}</td>
                  </tr>)}</tbody>
                </table>
                {visibleRows.length === 0 && <p className="empty-inline">Nama tidak ditemukan.</p>}
              </div>}
            </Card>
          </section>
        </>}
      </>}
    </section>
  </main>;
}

// Guest-facing attendance desk. The poster QR carries a wedding-scoped token, so the guest list
// cannot be enumerated by anyone who only guesses the slug.
function CheckInPage() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') || '';
  const [wedding, setWedding] = useState<Wedding>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<SearchResult>();
  const [notice, setNotice] = useState<Notice>(null);
  const [searching, setSearching] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { api.get<Wedding>(`/w/${slug}`).then(setWedding).catch(error => setNotice({ kind: 'error', text: error.message })); }, [slug]);
  useEffect(() => {
    window.clearTimeout(timer.current);
    setSelected(undefined);
    if (!token || query.trim().length < 3) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setSearching(true); setNotice(null);
      try { const data = await api.get<{ results: SearchResult[] }>(`/w/${slug}/check-in/search?q=${encodeURIComponent(query.trim())}&t=${encodeURIComponent(token)}`); setResults(data.results); }
      catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Pencarian gagal' }); }
      finally { setSearching(false); }
    }, 350);
    return () => window.clearTimeout(timer.current);
  }, [query, slug, token]);

  if (!wedding) return <main className="checkin-page"><Spinner label="Membuka meja tamu..."/><Alert notice={notice}/></main>;
  if (!token) return <main className="checkin-page"><motion.div className="checkin-shell" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
    <div className="checkin-brand"><Ornament/><p className="app-kicker">Meja tamu digital</p><h1>{couple(wedding)}</h1></div>
    <div className="checkin-success"><ShieldAlert/><h2>Tautan tidak lengkap</h2><p>Buka halaman ini dengan memindai QR check-in dari meja tamu. Hubungi petugas bila QR tidak terbaca.</p></div>
  </motion.div></main>;
  return <main className="checkin-page"><motion.div className="checkin-shell" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
    <div className="checkin-brand"><Ornament/><p className="app-kicker">Meja tamu digital</p><h1>{couple(wedding)}</h1><p>Tulis nama sesuai RSVP, pilih hasil yang cocok, lalu konfirmasi kehadiran.</p></div>
    {done ? <div className="checkin-success">
      <Check/><h2>Selamat datang</h2><p>Check-in <strong>{selected?.name}</strong> berhasil dicatat.</p>
      <Btn className="ink" onClick={() => { setDone(false); setSelected(undefined); setQuery(''); setResults([]); }}>Check-in tamu lain</Btn>
    </div> : <>
      <label className="checkin-search"><span>Cari nama tamu</span><div><Search/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Ketik minimal 3 karakter" autoComplete="off"/></div></label>
      <div aria-live="polite">
        {searching && <Spinner label="Mencari nama..."/>}
        {query.trim().length >= 3 && !searching && results.length === 0 && !notice && <p className="empty-inline">Nama belum ditemukan. Periksa ejaan atau hubungi petugas.</p>}
      </div>
      <Alert notice={notice}/>
      <div className="search-results">{results.map(result => <button key={result.id} disabled={Boolean(result.checked_in_at)} className={selected?.id === result.id ? 'selected' : ''} onClick={() => setSelected(result)}>
        <span><strong>{result.name}</strong><small>{result.guests_count} tamu</small></span>
        {result.checked_in_at ? <em>Sudah check-in</em> : selected?.id === result.id ? <Check/> : null}
      </button>)}</div>
      {selected && !selected.checked_in_at && <Btn className="ink confirm-checkin" onClick={async () => {
        setNotice(null);
        try { await api.post(`/w/${slug}/check-in`, { rsvp_id: selected.id, token }); setDone(true); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Check-in gagal' }); }
      }}>Konfirmasi kehadiran {selected.name}</Btn>}
    </>}
  </motion.div></main>;
}

export { Auth, CheckInPage, Dashboard };
