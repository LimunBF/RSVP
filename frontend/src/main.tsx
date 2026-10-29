import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CalendarDays, Check, ChevronDown, Clock3, Copy, ExternalLink, ImagePlus, LogOut,
  MapPin, Pencil, Plus, Search, Trash2, Upload, UserCheck, Users, X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  api, assetUrl, clock, couple, coverOf, dateInput, fullDate, galleryOf,
  type RSVP, type SearchResult, type Stats, type Wedding,
} from './api';
import './styles.css';

// Demo imagery from the owner's references. Uploaded photos for that wedding take priority.
const FALLBACK_COVER = 'https://i.pinimg.com/originals/65/40/30/65403052ec4819b76ecbdcbf5d31bce3.jpg';
const FALLBACK_GALLERY = [
  'https://i.pinimg.com/originals/82/8e/97/828e978a7b84c5387e8ba3835e4bf458.jpg',
  'https://i.pinimg.com/originals/eb/9f/ca/eb9fcacb9b90076f202db2d41d7962ea.jpg',
  'https://i.pinimg.com/originals/f2/60/6b/f2606b86a764cdbf962562ade9f70953.jpg',
  'https://i.pinimg.com/originals/e1/aa/63/e1aa63daed7b82dc4872d5dad0857e0b.jpg',
  'https://i.pinimg.com/originals/2a/4f/e2/2a4fe2fe019e0950733c9cc1bc294cd1.jpg',
];

type Notice = { kind: 'error' | 'success'; text: string } | null;
type RSVPForm = { name: string; attendance: 'yes' | 'no' | 'maybe'; session_id: string; guests_count: number; message: string };
type WeddingValues = { bride: string; groom: string; slug: string; event_date: string; deadline: string; location: string; story: string; cover_url: string };

// Batik Truntum derived mark: the star-flower repeated on traditional cloth, redrawn as line art.
function Ornament() {
  return <svg className="truntum-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4c4 24 22 42 46 46-24 4-42 22-46 46-4-24-22-42-46-46C28 46 46 28 50 4Z"/><circle cx="50" cy="50" r="14"/><circle cx="50" cy="50" r="4"/></svg>;
}
function Divider() { return <div className="heritage-divider" aria-hidden="true"><i/><Ornament/><i/></div>; }
function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button {...props} className={`action-btn ${props.className || ''}`}>{props.children}</button>; }
function Alert({ notice }: { notice: Notice }) { return notice ? <p role="alert" className={`notice ${notice.kind}`}>{notice.text}</p> : null; }
function Spinner({ label = 'Memuat...' }: { label?: string }) { return <div className="loading-state" role="status"><span/>{label}</div>; }

// Each field carries a label and one line saying what to type, so nobody has to guess a column.
function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{hint && <small className="field-hint">{hint}</small>}{children}</label>;
}
function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

// Countdown exists because the wedding date is far out and guests plan travel around it.
function Countdown({ target }: { target: string }) {
  const remaining = () => Math.max(0, new Date(target).getTime() - Date.now());
  const [left, setLeft] = useState(remaining);
  useEffect(() => { const timer = window.setInterval(() => setLeft(remaining()), 1000); return () => window.clearInterval(timer); }, [target]);
  const units: [number, string][] = [[Math.floor(left / 86400000), 'Hari'], [Math.floor(left / 3600000) % 24, 'Jam'], [Math.floor(left / 60000) % 60, 'Menit'], [Math.floor(left / 1000) % 60, 'Detik']];
  return <div className="countdown" aria-label="Hitung mundur menuju hari pernikahan">{units.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div>;
}

function Opening({ wedding, onOpen }: { wedding: Wedding; onOpen: () => void }) {
  const reduced = useReducedMotion();
  return <motion.div className="opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .6 }} style={{ backgroundImage: `linear-gradient(180deg, rgba(22,14,9,.35), rgba(22,14,9,.62) 45%, rgba(22,14,9,.88)), url(${coverOf(wedding) || FALLBACK_COVER})` }}>
    <motion.div className="opening-frame" animate={reduced ? undefined : { rotate: [0, 5, 0] }} transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}><Ornament/></motion.div>
    <motion.div className="opening-copy" initial={reduced ? false : { opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .8 }}>
      <p>The Wedding of</p>
      <h1>{couple(wedding)}</h1>
      <time dateTime={wedding.event_date}>{fullDate(wedding.event_date)}</time>
      <Btn className="gold" onClick={onOpen}>Buka Undangan <ChevronDown size={18}/></Btn>
    </motion.div>
  </motion.div>;
}

function Public() {
  const { slug = '' } = useParams();
  const [wedding, setWedding] = useState<Wedding>();
  const [notice, setNotice] = useState<Notice>(null);
  const [opened, setOpened] = useState(false);
  const [lang, setLang] = useState<'id' | 'jv'>('id');
  const [done, setDone] = useState(false);
  const [lightbox, setLightbox] = useState<string>();
  const reduced = useReducedMotion();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RSVPForm>({ defaultValues: { attendance: 'yes', guests_count: 1, session_id: '' } });
  const attending = watch('attendance') === 'yes';

  useEffect(() => { api.get<Wedding>(`/w/${slug}`).then(setWedding).catch(error => setNotice({ kind: 'error', text: error.message })); }, [slug]);
  useEffect(() => {
    if (!lightbox) return;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightbox(undefined); };
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = ''; };
  }, [lightbox]);

  if (!wedding) return <main className="public-state"><div><Ornament/><h1>Sowan.</h1><Alert notice={notice}/>{!notice && <Spinner label="Menyiapkan undangan..."/>}</div></main>;
  if (!opened) return <AnimatePresence mode="wait"><Opening wedding={wedding} onOpen={() => setOpened(true)}/></AnimatePresence>;

  const day = wedding.event_date.slice(0, 10).replace(/-/g, '');
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Pernikahan ${couple(wedding)}`)}&dates=${day}/${day}&location=${encodeURIComponent(wedding.location)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.location)}`;
  const sessions = wedding.sessions.length ? wedding.sessions : [{ id: 0, label: 'Resepsi Pernikahan', start_time: wedding.event_date, end_time: wedding.event_date, sort_order: 0 }];
  const uploaded = galleryOf(wedding);
  const gallery = uploaded.length ? uploaded.map(image => ({ url: image.url, alt: image.alt_text || 'Foto galeri pernikahan' })) : FALLBACK_GALLERY.map((url, index) => ({ url, alt: `Foto contoh galeri ${index + 1}` }));

  const submit = async (values: RSVPForm) => {
    setNotice(null);
    try {
      await api.post(`/w/${slug}/rsvp`, { ...values, session_id: attending ? Number(values.session_id) : undefined, guests_count: attending ? Number(values.guests_count) : 0 });
      setDone(true);
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Konfirmasi gagal dikirim' }); }
  };

  return <motion.main className="wedding-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .6 }}>
    <nav className="floating-nav" aria-label="Navigasi undangan">
      <a href="#acara">Acara</a><a href="#galeri">Galeri</a><a href="#rsvp">RSVP</a>
      <button onClick={() => setLang(lang === 'id' ? 'jv' : 'id')} aria-label="Ganti bahasa">{lang === 'id' ? 'JV' : 'ID'}</button>
    </nav>

    <section className="hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(26,17,10,.55), rgba(26,17,10,.68) 40%, rgba(26,17,10,.9)), url(${coverOf(wedding) || FALLBACK_COVER})` }}>
      <motion.div className="hero-copy" initial={reduced ? false : { opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .9 }}>
        <div className="hero-ornament"><Ornament/></div>
        <p>{lang === 'id' ? 'Dengan hormat kami mengundang' : 'Katur dhumateng panjenengan'}</p>
        <h1>{couple(wedding)}</h1>
        <Divider/>
        <time dateTime={wedding.event_date}>{fullDate(wedding.event_date)}</time>
        <a className="text-action" href={calendarUrl} target="_blank" rel="noreferrer"><CalendarDays size={18}/> Simpan tanggal</a>
      </motion.div>
      <a className="scroll-cue" href="#pembuka" aria-label="Lanjut ke isi undangan"><ChevronDown/></a>
    </section>

    <section id="pembuka" className="verse section-pad">
      <Reveal>
        <Ornament/>
        <blockquote>“Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.”</blockquote>
        <p>QS. Ar-Rum: 21</p>
      </Reveal>
    </section>

    <section className="couple-section section-pad">
      <Reveal className="section-heading"><span>Kedua mempelai</span><h2>Satu perjalanan,<br/>satu tujuan</h2></Reveal>
      <Reveal className="couple-portrait"><img src={coverOf(wedding) || FALLBACK_COVER} alt={`Potret ${couple(wedding)}`}/><span className="portrait-stamp"><Ornament/></span></Reveal>
      <Reveal className="couple-names">
        <article><span>01</span><h3>{wedding.bride}</h3><p>Mempelai wanita</p></article>
        <i>&</i>
        <article><span>02</span><h3>{wedding.groom}</h3><p>Mempelai pria</p></article>
      </Reveal>
      <Reveal className="story"><p>{wedding.story || 'Dengan penuh syukur, kami mengundang Anda untuk menjadi bagian dari hari bahagia kami.'}</p></Reveal>
    </section>

    <section id="acara" className="event-section section-pad">
      <Reveal className="event-intro"><p>Save the date</p><h2>{fullDate(wedding.event_date)}</h2><Countdown target={wedding.event_date}/></Reveal>
      <div className="event-list">
        {sessions.map((session, index) => <Reveal key={session.id}>
          <article>
            <span className="event-number">0{index + 1}</span>
            <div><p className="event-label">Rangkaian acara</p><h3>{session.label}</h3></div>
            <dl>
              <div><dt><Clock3 size={18}/> Waktu</dt><dd>{clock(session.start_time)} WIB</dd></div>
              <div><dt><MapPin size={18}/> Lokasi</dt><dd>{wedding.location}</dd></div>
            </dl>
          </article>
        </Reveal>)}
      </div>
      <div className="event-actions">
        <a className="action-link gold" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={18}/> Buka Google Maps</a>
        <a className="action-link outline" href={calendarUrl} target="_blank" rel="noreferrer"><CalendarDays size={18}/> Tambah ke kalender</a>
      </div>
    </section>

    <section id="galeri" className="gallery-section section-pad">
      <Reveal className="section-heading light"><span>Potongan cerita</span><h2>Dalam bingkai,<br/>selamanya</h2></Reveal>
      <div className="gallery-grid">
        {gallery.map((image, index) => <motion.button key={image.url} whileHover={reduced ? undefined : { scale: 1.015 }} transition={{ duration: .25 }} onClick={() => setLightbox(image.url)} aria-label={`Perbesar foto galeri ${index + 1}`}>
          <img src={image.url} alt={image.alt}/><span>0{index + 1}</span>
        </motion.button>)}
      </div>
    </section>

    <section id="rsvp" className="rsvp-section section-pad">
      <Reveal className="rsvp-intro">
        <span>Konfirmasi kehadiran</span>
        <h2>Hadirmu melengkapi cerita kami.</h2>
        <p>Mohon isi konfirmasi agar kami dapat menyambutmu dengan baik.</p>
        <Divider/>
      </Reveal>
      <Reveal className="rsvp-panel">
        <AnimatePresence mode="wait">
          {done ? <motion.div key="done" className="thanks" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
            <Check/><h3>Terima kasih</h3><p>Konfirmasi kehadiranmu sudah kami terima.</p>
          </motion.div> : <motion.form key="form" onSubmit={handleSubmit(submit)} noValidate exit={{ opacity: 0 }}>
            <label>Nama lengkap<input autoComplete="name" {...register('name', { required: 'Nama wajib diisi', maxLength: { value: 100, message: 'Maksimal 100 karakter' } })}/>{errors.name && <small>{errors.name.message}</small>}</label>
            <fieldset>
              <legend>Apakah kamu akan hadir?</legend>
              <div className="attendance-options">
                {([['yes', 'Hadir'], ['maybe', 'Mungkin'], ['no', 'Tidak hadir']] as const).map(([value, label]) => <label key={value}><input type="radio" value={value} {...register('attendance')}/><span>{label}</span></label>)}
              </div>
            </fieldset>
            {attending && <div className="form-row">
              <label>Sesi acara<select {...register('session_id', { required: 'Pilih sesi acara' })}><option value="">Pilih sesi</option>{wedding.sessions.map(session => <option key={session.id} value={session.id}>{session.label}, {clock(session.start_time)}</option>)}</select>{errors.session_id && <small>{errors.session_id.message}</small>}</label>
              <label>Jumlah tamu<input type="number" min="1" max="20" {...register('guests_count', { valueAsNumber: true, min: 1, max: 20 })}/></label>
            </div>}
            <label>Ucapan atau doa<textarea rows={4} maxLength={500} {...register('message')} placeholder="Tuliskan doa terbaikmu..."/></label>
            <Alert notice={notice}/>
            <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Mengirim...' : 'Kirim konfirmasi'}</Btn>
          </motion.form>}
        </AnimatePresence>
      </Reveal>
    </section>

    <footer>
      <Ornament/>
      <p>Atas kehadiran dan doa restu Anda, kami mengucapkan terima kasih.</p>
      <h2>{couple(wedding)}</h2>
      <small>Sowan.</small>
    </footer>

    <AnimatePresence>
      {lightbox && <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label="Foto galeri" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(undefined)}>
        <button autoFocus onClick={() => setLightbox(undefined)} aria-label="Tutup galeri"><X/></button>
        <motion.img src={lightbox} alt="Foto galeri diperbesar" initial={{ scale: .93 }} animate={{ scale: 1 }} exit={{ scale: .93 }} onClick={event => event.stopPropagation()}/>
      </motion.div>}
    </AnimatePresence>
  </motion.main>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`app-card ${className}`}>{children}</section>; }

function Auth({ mode }: { mode: 'login' | 'register' }) {
  const nav = useNavigate();
  const [notice, setNotice] = useState<Notice>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ name: string; email: string; password: string; confirmation: string }>();
  return <main className="auth-page">
    <Link className="brand" to="/login">Sowan.</Link>
    <Card>
      <p className="app-kicker">Organizer</p>
      <h1>{mode === 'register' ? 'Buat akun' : 'Selamat datang kembali'}</h1>
      <p>Kelola undangan dan kehadiran tamu dalam satu tempat.</p>
      <form className="app-form" onSubmit={handleSubmit(async values => {
        setNotice(null);
        if (mode === 'register' && values.password !== values.confirmation) { setNotice({ kind: 'error', text: 'Konfirmasi kata sandi tidak sama' }); return; }
        try { const result = await api.post<{ token: string }>(`/auth/${mode}`, values); localStorage.setItem('rsvp-token', result.token); nav('/dashboard'); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal masuk' }); }
      })}>
        {mode === 'register' && <label>Nama<input {...register('name', { required: true })}/></label>}
        <label>Email<input type="email" autoComplete="email" {...register('email', { required: true })}/></label>
        <label>Kata sandi<div className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} {...register('password', { required: true, minLength: 8 })}/><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Sembunyikan' : 'Lihat'}</button></div></label>
        {mode === 'register' && <label>Ulangi kata sandi<input type={showPassword ? 'text' : 'password'} autoComplete="new-password" {...register('confirmation', { required: true })}/></label>}
        <Alert notice={notice}/>
        <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Memproses...' : mode === 'register' ? 'Daftar' : 'Masuk'}</Btn>
      </form>
      <p className="auth-switch"><Link to={mode === 'register' ? '/login' : '/register'}>{mode === 'register' ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</Link></p>
    </Card>
  </main>;
}

function WeddingForm({ token, wedding, done, cancel }: { token: string; wedding?: Wedding; done: (message: string) => void; cancel: () => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<WeddingValues>({
    defaultValues: wedding ? { bride: wedding.bride, groom: wedding.groom, slug: wedding.slug, event_date: dateInput(wedding.event_date), deadline: wedding.deadline ? dateInput(wedding.deadline) : '', location: wedding.location, story: wedding.story, cover_url: wedding.cover_url.startsWith('http') ? wedding.cover_url : '' } : {},
  });
  return <Card className="editor-card">
    <div className="card-heading"><div><p className="app-kicker">{wedding ? 'Edit acara' : 'Acara baru'}</p><h2>{wedding ? couple(wedding) : 'Buat undangan'}</h2></div><button className="icon-btn" onClick={cancel} aria-label="Tutup form"><X/></button></div>
    <form className="grid-form" onSubmit={handleSubmit(async values => {
      setNotice(null);
      try {
        if (wedding) await api.put(`/api/weddings/${wedding.id}`, values, token);
        else await api.post('/api/weddings', values, token);
        done(wedding ? 'Perubahan acara disimpan.' : 'Acara baru berhasil dibuat.');
      } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menyimpan acara' }); }
    })}>
      <Field label="Mempelai wanita" hint="Nama yang tampil pertama di undangan"><input {...register('bride', { required: true })}/></Field>
      <Field label="Mempelai pria" hint="Nama yang tampil kedua di undangan"><input {...register('groom', { required: true })}/></Field>
      <Field label="Slug tautan" hint="Huruf kecil, angka, dan tanda minus. Contoh: anisa-bima"><input {...register('slug', { required: true, pattern: /^[a-z0-9-]+$/ })}/></Field>
      <Field label="Tanggal acara" hint="Dipakai untuk countdown dan tautan kalender"><input type="date" {...register('event_date', { required: true })}/></Field>
      <Field label="Batas RSVP" hint="Opsional. Hari terakhir tamu boleh konfirmasi"><input type="date" {...register('deadline')}/></Field>
      <Field label="Lokasi" hint="Nama gedung dan alamat singkat, dipakai untuk Google Maps"><input {...register('location', { required: true })}/></Field>
      <Field label="Cover URL cadangan" hint="Opsional. Upload foto di panel Foto undangan lebih disarankan" wide><input type="url" {...register('cover_url')}/></Field>
      <Field label="Cerita pasangan" hint="Maksimal 3000 karakter. Tampil di bagian profil mempelai" wide><textarea rows={5} maxLength={3000} {...register('story')}/></Field>
      <Alert notice={notice}/>
      <div className="form-actions"><Btn type="button" className="outline-btn" onClick={cancel}>Batal</Btn><Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan acara'}</Btn></div>
    </form>
  </Card>;
}

function Sessions({ wedding, token, reload, toast }: { wedding: Wedding; token: string; reload: () => Promise<void>; toast: (text: string) => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();
  return <div className="dashboard-section">
    <div className="section-title"><div><h2>Sesi acara</h2><p>Atur akad, resepsi, atau sesi tamu. Maksimal tiga sesi.</p></div></div>
    <ul className="sessions">{wedding.sessions.map(session => <li key={session.id}>
      <span><strong>{session.label}</strong><small>{new Date(session.start_time).toLocaleString('id-ID')}</small></span>
      <button className="icon-btn" aria-label={`Hapus ${session.label}`} onClick={async () => {
        if (!confirm(`Hapus sesi ${session.label}?`)) return;
        try { await api.del(`/api/weddings/${wedding.id}/sessions/${session.id}`, token); await reload(); toast('Sesi berhasil dihapus.'); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menghapus sesi' }); }
      }}><Trash2 size={17}/></button>
    </li>)}</ul>
    {wedding.sessions.length < 3 && <form className="session-form" onSubmit={handleSubmit(async values => {
      setNotice(null);
      try { await api.post(`/api/weddings/${wedding.id}/sessions`, values, token); reset(); await reload(); toast('Sesi berhasil ditambahkan.'); }
      catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menambah sesi' }); }
    })}>
      <Field label="Nama sesi" hint="Contoh: Akad Nikah"><input placeholder="Akad Nikah" {...register('label', { required: true })}/></Field>
      <Field label="Waktu mulai"><input type="datetime-local" {...register('start_time', { required: true })}/></Field>
      <Field label="Waktu selesai"><input type="datetime-local" {...register('end_time', { required: true })}/></Field>
      <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Menambahkan...' : 'Tambah sesi'}</Btn>
    </form>}
    <Alert notice={notice}/>
  </div>;
}

function MediaManager({ wedding, token, reload, toast }: { wedding: Wedding; token: string; reload: () => Promise<void>; toast: (text: string) => void }) {
  const [kind, setKind] = useState<'cover' | 'gallery'>('gallery');
  const [file, setFile] = useState<File>();
  const [alt, setAlt] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setNotice({ kind: 'error', text: 'Pilih foto terlebih dahulu.' }); return; }
    setBusy(true); setNotice(null);
    const form = new FormData();
    form.append('kind', kind); form.append('file', file); form.append('alt_text', alt);
    try {
      await api.upload(`/api/weddings/${wedding.id}/images`, form, token);
      setFile(undefined); setAlt(''); await reload();
      toast(kind === 'cover' ? 'Cover berhasil diganti.' : 'Foto galeri berhasil ditambahkan.');
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Upload gagal' }); }
    finally { setBusy(false); }
  };
  return <div className="dashboard-section">
    <div className="section-title"><div><h2>Foto undangan</h2><p>JPG, PNG, atau WebP, maksimal 8 MB. File tersimpan di folder acara ini.</p></div><ImagePlus/></div>
    <form className="upload-form" onSubmit={upload}>
      <Field label="Jenis foto"><select value={kind} onChange={event => setKind(event.target.value as 'cover' | 'gallery')}><option value="cover">Cover utama</option><option value="gallery">Galeri</option></select></Field>
      <Field label="Pilih foto"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0])}/></Field>
      <Field label="Deskripsi foto" hint="Membantu pembaca layar memahami isi foto"><input value={alt} onChange={event => setAlt(event.target.value)} placeholder="Anisa dan Bima di taman"/></Field>
      <Btn className="ink" disabled={busy}><Upload size={18}/>{busy ? 'Mengunggah...' : 'Upload foto'}</Btn>
    </form>
    <Alert notice={notice}/>
    <div className="media-grid">{wedding.images.length === 0 ? <p className="empty-inline">Belum ada foto upload. Undangan memakai cover URL atau gambar contoh.</p> : wedding.images.map(image => <figure key={image.id}>
      <img src={assetUrl(image.path)} alt={image.alt_text || image.original_name}/>
      <figcaption><span>{image.kind === 'cover' ? 'Cover' : 'Galeri'}</span><button aria-label={`Hapus ${image.original_name}`} onClick={async () => {
        if (!confirm('Hapus foto ini?')) return;
        try { await api.del(`/api/weddings/${wedding.id}/images/${image.id}`, token); await reload(); toast('Foto berhasil dihapus.'); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Gagal menghapus foto' }); }
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
  const [stats, setStats] = useState<Stats>({ total: 0, yes: 0, no: 0, maybe: 0, guests: 0 });
  const [notice, setNotice] = useState<Notice>(null);
  const [toast, setToast] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guestQuery, setGuestQuery] = useState('');

  const load = async () => { if (!token) return; const data = await api.get<Wedding[]>('/api/weddings', token); setWeddings(data); setSelected(current => data.find(item => item.id === current?.id) || data[0]); };
  const loadRows = async (id = selected?.id) => { if (!id || !token) return; const result = await api.get<{ rsvps: RSVP[]; stats: Stats }>(`/api/weddings/${id}/rsvps`, token); setRows(result.rsvps); setStats(result.stats); };
  const refresh = async () => { await load(); await loadRows(); };
  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(''), 3200); };

  useEffect(() => { if (!token) nav('/login'); else load().catch(error => setNotice({ kind: 'error', text: error.message })).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (selected && token) loadRows(selected.id).catch(error => setNotice({ kind: 'error', text: error.message })); }, [selected?.id]);
  if (!token) return null;

  const invitationUrl = `${location.origin}/w/${selected?.slug || ''}`;
  const checkInUrl = `${location.origin}/check-in/${selected?.slug || ''}`;
  const visibleRows = rows.filter(row => row.name.toLowerCase().includes(guestQuery.toLowerCase()));
  const checked = rows.filter(row => row.checked_in_at).length;

  return <main className="dashboard">
    <aside>
      <Link className="brand" to="/dashboard">Sowan.</Link>
      <nav aria-label="Daftar acara">{weddings.map(wedding => <button className={selected?.id === wedding.id ? 'active' : ''} key={wedding.id} onClick={() => { setSelected(wedding); setEditing(false); setCreating(false); }}>{couple(wedding)}</button>)}</nav>
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
        {creating && <WeddingForm token={token} cancel={() => setCreating(false)} done={async message => { setCreating(false); await load(); showToast(message); }}/>}
        {editing && selected && <WeddingForm token={token} wedding={selected} cancel={() => setEditing(false)} done={async message => { setEditing(false); await load(); showToast(message); }}/>}
        {!selected && !creating && <Card className="empty-state"><Plus/><h2>Belum ada acara</h2><p>Buat acara pertama untuk mendapatkan halaman undangan, QR, dan daftar RSVP.</p><Btn className="ink" onClick={() => setCreating(true)}>Buat acara pertama</Btn></Card>}
        {selected && !creating && !editing && <>
          <section className="summary">
            <Card><Users/><strong>{stats.total}</strong><span>RSVP masuk</span></Card>
            <Card><Check/><strong>{stats.guests}</strong><span>Tamu terkonfirmasi</span></Card>
            <Card><UserCheck/><strong>{checked}</strong><span>Sudah check-in</span></Card>
            <Card><strong>{stats.no}</strong><span>Tidak hadir</span></Card>
          </section>
          <section className="dashboard-layout">
            <Card className="event-control">
              <div className="card-heading"><div><p className="app-kicker">Tautan acara</p><h2>{couple(selected)}</h2></div><a className="preview-link" href={invitationUrl} target="_blank" rel="noreferrer">Lihat undangan <ExternalLink size={16}/></a></div>
              <p>{selected.location}</p>
              <div className="link-box"><div><small>Undangan</small><code>{invitationUrl}</code></div><button onClick={async () => { await navigator.clipboard.writeText(invitationUrl); showToast('Tautan undangan disalin.'); }}><Copy size={16}/> Salin</button></div>
              <div className="qr-pair">
                <div><QRCodeSVG value={invitationUrl} size={128}/><strong>QR Undangan</strong><small>Membuka undangan</small></div>
                <div><QRCodeSVG value={checkInUrl} size={128}/><strong>QR Check-in</strong><small>Absensi hari acara</small></div>
              </div>
              <Sessions wedding={selected} token={token} reload={refresh} toast={showToast}/>
              <MediaManager wedding={selected} token={token} reload={refresh} toast={showToast}/>
            </Card>
            <Card className="guest-card">
              <div className="card-heading"><div><p className="app-kicker">Operasional tamu</p><h2>Daftar hadir</h2></div><span className="attendance-count">{checked}/{rows.filter(row => row.attendance === 'yes').length} check-in</span></div>
              <label className="search-field"><Search size={18}/><input value={guestQuery} onChange={event => setGuestQuery(event.target.value)} placeholder="Cari nama tamu" aria-label="Cari nama tamu"/></label>
              {rows.length === 0 ? <div className="empty-inline"><Users/><p>Belum ada RSVP masuk.</p></div> : <div className="table-wrap">
                <table>
                  <thead><tr><th>Nama</th><th>Status RSVP</th><th>Sesi</th><th>Tamu</th><th>Absensi</th></tr></thead>
                  <tbody>{visibleRows.map(row => <tr key={row.id}>
                    <td><strong>{row.name}</strong>{row.message && <small>{row.message}</small>}</td>
                    <td><span className={`status ${row.attendance}`}>{row.attendance === 'yes' ? 'Hadir' : row.attendance === 'maybe' ? 'Mungkin' : 'Tidak hadir'}</span></td>
                    <td>{row.session?.label || '-'}</td>
                    <td>{row.guests_count}</td>
                    <td>{row.attendance !== 'yes' ? '-' : <button className={`check-button ${row.checked_in_at ? 'checked' : ''}`} onClick={async () => {
                      try {
                        if (row.checked_in_at) await api.del(`/api/weddings/${selected.id}/rsvps/${row.id}/check-in`, token);
                        else await api.post(`/api/weddings/${selected.id}/rsvps/${row.id}/check-in`, {}, token);
                        await loadRows(selected.id);
                        showToast(row.checked_in_at ? 'Check-in dibatalkan.' : `${row.name} berhasil check-in.`);
                      } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Absensi gagal' }); }
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

// Guest-facing attendance desk. The QR poster points here; the guest types a name, the backend
// matches the wedding's RSVP list, and check-in is recorded once. No other guest data is returned.
function CheckInPage() {
  const { slug = '' } = useParams();
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
    if (query.trim().length < 3) { setResults([]); return; }
    timer.current = window.setTimeout(async () => {
      setSearching(true); setNotice(null);
      try { const data = await api.get<{ results: SearchResult[] }>(`/w/${slug}/check-in/search?q=${encodeURIComponent(query.trim())}`); setResults(data.results); }
      catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Pencarian gagal' }); }
      finally { setSearching(false); }
    }, 350);
    return () => window.clearTimeout(timer.current);
  }, [query, slug]);

  if (!wedding) return <main className="checkin-page"><Spinner label="Membuka meja tamu..."/><Alert notice={notice}/></main>;
  return <main className="checkin-page"><motion.div className="checkin-shell" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
    <div className="checkin-brand"><Ornament/><p className="app-kicker">Meja tamu digital</p><h1>{couple(wedding)}</h1><p>Tulis nama sesuai RSVP, pilih hasil yang cocok, lalu konfirmasi kehadiran.</p></div>
    {done ? <div className="checkin-success">
      <Check/><h2>Selamat datang</h2><p>Check-in <strong>{selected?.name}</strong> berhasil dicatat.</p>
      <Btn className="ink" onClick={() => { setDone(false); setSelected(undefined); setQuery(''); setResults([]); }}>Check-in tamu lain</Btn>
    </div> : <>
      <label className="checkin-search"><span>Cari nama tamu</span><div><Search/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Ketik minimal 3 karakter" autoComplete="off"/></div></label>
      {searching && <Spinner label="Mencari nama..."/>}
      <Alert notice={notice}/>
      {query.trim().length >= 3 && !searching && results.length === 0 && <p className="empty-inline">Nama belum ditemukan. Periksa ejaan atau hubungi petugas.</p>}
      <div className="search-results">{results.map(result => <button key={result.id} disabled={Boolean(result.checked_in_at)} className={selected?.id === result.id ? 'selected' : ''} onClick={() => setSelected(result)}>
        <span><strong>{result.name}</strong><small>{result.guests_count} tamu</small></span>
        {result.checked_in_at ? <em>Sudah check-in</em> : selected?.id === result.id ? <Check/> : null}
      </button>)}</div>
      {selected && !selected.checked_in_at && <Btn className="ink confirm-checkin" onClick={async () => {
        setNotice(null);
        try { await api.post(`/w/${slug}/check-in`, { rsvp_id: selected.id }); setDone(true); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Check-in gagal' }); }
      }}>Konfirmasi kehadiran {selected.name}</Btn>}
    </>}
  </motion.div></main>;
}

function App() {
  return <Routes>
    <Route path="/w/:slug" element={<Public/>}/>
    <Route path="/check-in/:slug" element={<CheckInPage/>}/>
    <Route path="/login" element={<Auth mode="login"/>}/>
    <Route path="/register" element={<Auth mode="register"/>}/>
    <Route path="/dashboard" element={<Dashboard/>}/>
    <Route path="*" element={<Navigate to="/login"/>}/>
  </Routes>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>);