import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, MapPin, X } from 'lucide-react';
import { api, clock, couple, coverOf, fullDate, galleryOf, type RSVP, type Wedding } from './api';
import { Alert, Btn, EASE, Ornament, Spinner, type Notice } from './ui';

// Local fallbacks only. Hotlinked stock photos are an unreliable network and licensing dependency.
const FALLBACK_COVER = '/assets/wayang/kelir-cephas-pd.jpg';
const FALLBACK_GALLERY: [string, string][] = [
  ['/assets/wayang/arjuna-museum.jpg', 'Artefak wayang kulit Arjuna, Collectie Wereldmuseum'],
  ['/assets/wayang/bima-museum.jpg', 'Artefak wayang kulit Bima, Collectie Wereldmuseum'],
  ['/assets/wayang/kelir-cephas-pd.jpg', 'Pagelaran wayang kulit, foto Kassian Cephas'],
];

type RSVPForm = { name: string; attendance: 'yes' | 'no' | 'maybe'; session_id: string; guests_count: number; message: string };

// Gunungan marks the beginning of a story. Used once, as the opening focal point.
function Gunungan() {
  return <svg className="gunungan-mark" viewBox="0 0 160 220" aria-hidden="true"><path className="gunungan-body" d="M80 8C64 43 24 86 18 146c-3 31 17 54 62 66 45-12 65-35 62-66C136 86 96 43 80 8Z"/><path d="M80 31v151M80 58C57 72 43 96 39 127M80 58c23 14 37 38 41 69M80 87c-17 5-28 16-34 32M80 87c17 5 28 16 34 32M80 116c-13 6-21 16-25 29M80 116c13 6 21 16 25 29"/><path d="M48 151c10-8 20-12 32-12s22 4 32 12M39 169h82M51 186h58"/><circle cx="80" cy="70" r="8"/></svg>;
}

function WayangFigure({ side, className = '' }: { side: 'left' | 'right'; className?: string }) {
  const src = side === 'left' ? '/assets/wayang/arjuna-museum.jpg' : '/assets/wayang/bima-museum.jpg';
  return <img className={`wayang-figure ${side} ${className}`} src={src} alt="" aria-hidden="true" decoding="async"/>;
}

// Two intensities: the full kelir is the opening act, later scenes only keep a small silhouette frame.
function StageSet({ variant = 'light' }: { variant?: 'light' | 'dark' | 'photo' }) {
  if (variant !== 'photo') return <div className={`stage-accent ${variant}`} aria-hidden="true"><div className="stage-veil"/><WayangFigure side="left"/><WayangFigure side="right"/></div>;
  return <div className={`stage-set ${variant}`} aria-hidden="true">
    <div className="historic-kelir"/><div className="blencong-light"/><div className="kelir-grain"/>
    <WayangFigure side="left"/><WayangFigure side="right"/>
    <div className="stage-base"/>
  </div>;
}

function SceneDivider({ label }: { label: string }) {
  const reduced = useReducedMotion();
  return <motion.div className="scene-divider" aria-hidden="true"
    initial={reduced ? false : { clipPath: 'inset(0 50% 0 50%)' }} whileInView={{ clipPath: 'inset(0 0% 0 0%)' }}
    viewport={{ once: true, amount: .6 }} transition={{ duration: 1, ease: EASE }}>
    <i/><span><Gunungan/></span><b>{label}</b><i/>
  </motion.div>;
}

function Divider() { return <div className="heritage-divider" aria-hidden="true"><i/><Ornament/><i/></div>; }

// Transform-only reveals: core content stays visible if motion never runs.
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className}
    initial={reduced ? false : { opacity: 1, y: 54, rotateX: 5, scale: .985 }}
    whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
    viewport={{ once: true, amount: .2 }}
    transition={{ duration: .95, ease: EASE, delay }}>{children}</motion.div>;
}

// Minutes are enough for planning; a per-second tick only costs repaints.
function Countdown({ target }: { target: string }) {
  const ms = () => Math.max(0, new Date(target).getTime() - Date.now());
  const [left, setLeft] = useState(ms);
  useEffect(() => { const timer = window.setInterval(() => setLeft(ms()), 30000); return () => window.clearInterval(timer); }, [target]);
  const units: [number, string][] = [[Math.floor(left / 86400000), 'Hari'], [Math.floor(left / 3600000) % 24, 'Jam'], [Math.floor(left / 60000) % 60, 'Menit']];
  return <div className="countdown" aria-label="Hitung mundur menuju hari pernikahan">{units.map(([value, label]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div>;
}

function Opening({ wedding, onOpen }: { wedding: Wedding; onOpen: () => void }) {
  const reduced = useReducedMotion();
  return <motion.div className="opening wayang-opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={reduced ? { opacity: 0 } : { clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: reduced ? .2 : 0.75, ease: EASE }}>
    <div className="opening-photo" style={{ backgroundImage: `url(${coverOf(wedding) || FALLBACK_COVER})` }}/>
    <StageSet variant="photo"/>
    <motion.div className="opening-frame gunungan-frame" initial={reduced ? false : { y: -90, scale: .72 }} animate={{ y: 0, scale: 1 }} transition={{ delay: .15, duration: 1.25, ease: EASE }}><Gunungan/></motion.div>
    <motion.div className="opening-copy" initial={reduced ? false : { y: 48, filter: 'blur(10px)' }} animate={{ y: 0, filter: 'blur(0px)' }} transition={{ delay: .3, duration: 1.05, ease: EASE }}>
      <p>Pagelaran Pawiwahan</p>
      <h1>{couple(wedding)}</h1>
      <time dateTime={wedding.event_date}>{fullDate(wedding.event_date)}</time>
      <Btn className="gold" onClick={onOpen}>Buka undangan <ChevronDown size={18}/></Btn>
    </motion.div>
  </motion.div>;
}

// Gallery lightbox as a real dialog: focus moves in, Tab is trapped, background is inert, focus returns to the trigger.
function Lightbox({ images, index, onClose, onStep }: { images: { url: string; alt: string }[]; index: number; onClose: () => void; onStep: (delta: number) => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const main = document.querySelector('main.wedding-page');
    main?.setAttribute('aria-hidden', 'true');
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') onStep(1);
      if (event.key === 'ArrowLeft') onStep(-1);
      if (event.key !== 'Tab') return;
      const focusable = boxRef.current?.querySelectorAll<HTMLElement>('button');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; main?.removeAttribute('aria-hidden'); };
  }, [onClose, onStep]);
  const image = images[index];
  return <motion.div ref={boxRef} className="lightbox" role="dialog" aria-modal="true" aria-label={`Foto galeri ${index + 1} dari ${images.length}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <button ref={closeRef} className="lb-close" onClick={onClose} aria-label="Tutup galeri"><X/></button>
    {images.length > 1 && <>
      <button className="lb-prev" onClick={event => { event.stopPropagation(); onStep(-1); }} aria-label="Foto sebelumnya"><ChevronLeft/></button>
      <button className="lb-next" onClick={event => { event.stopPropagation(); onStep(1); }} aria-label="Foto berikutnya"><ChevronRight/></button>
    </>}
    <motion.img key={image.url} src={image.url} alt={image.alt} initial={{ scale: .93 }} animate={{ scale: 1 }} exit={{ scale: .93 }} onClick={event => event.stopPropagation()}/>
    <p className="lb-caption" onClick={event => event.stopPropagation()}>{index + 1} / {images.length}</p>
  </motion.div>;
}

function Public() {
  const { slug = '' } = useParams();
  const [wedding, setWedding] = useState<Wedding>();
  const [notice, setNotice] = useState<Notice>(null);
  const [opened, setOpened] = useState(false);
  const [done, setDone] = useState(false);
  const [lightbox, setLightbox] = useState<number>();
  const reduced = useReducedMotion();
  const pageRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, .25], ['0%', '18%']);
  const heroImageY = useTransform(scrollYProgress, [0, .25], ['0%', '-12%']);
  const heroFade = useTransform(scrollYProgress, [0, .2], [1, .55]);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RSVPForm>({ defaultValues: { attendance: 'yes', guests_count: 1, session_id: '' } });
  const attending = watch('attendance') === 'yes';

  useEffect(() => { api.get<Wedding>(`/w/${slug}`).then(setWedding).catch(error => setNotice({ kind: 'error', text: error.message })); }, [slug]);

  const closeLightbox = () => { setLightbox(undefined); triggerRef.current?.focus(); };

  if (!wedding) return <main className="public-state"><div><Ornament/><h1>Sowan.</h1><Alert notice={notice}/>{!notice && <Spinner label="Menyiapkan undangan..."/>}</div></main>;
  if (!opened) return <AnimatePresence mode="wait"><Opening wedding={wedding} onOpen={() => setOpened(true)}/></AnimatePresence>;

  const sessions = wedding.sessions;
  const first = sessions[0];
  const deadline = wedding.deadline ? new Date(wedding.deadline) : undefined;
  const closed = Boolean(deadline && Date.now() > deadline.getTime());
  const start = first ? new Date(first.start_time) : new Date(wedding.event_date);
  const end = first ? new Date(first.end_time) : new Date(wedding.event_date);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Pernikahan ${couple(wedding)}`)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(wedding.location)}&details=${encodeURIComponent('Kami menantikan kehadiran Anda.')}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.location)}`;
  const uploaded = galleryOf(wedding);
  const gallery = uploaded.length ? uploaded.map(image => ({ url: image.url, alt: image.alt_text || 'Foto galeri pernikahan' })) : FALLBACK_GALLERY.map(([url, alt]) => ({ url, alt }));

  const submit = async (values: RSVPForm) => {
    setNotice(null);
    try {
      await api.post(`/w/${slug}/rsvp`, { ...values, session_id: attending && values.session_id ? Number(values.session_id) : undefined, guests_count: attending ? Number(values.guests_count) : 0 });
      setDone(true);
    } catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Konfirmasi gagal dikirim' }); }
  };

  return <motion.main ref={pageRef} className="wedding-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .55 }}>
    <motion.nav className="floating-nav" aria-label="Navigasi undangan" initial={reduced ? false : { opacity: 0, y: -22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .65, duration: .6, ease: EASE }}>
      <a href="#acara">Acara</a><a href="#galeri">Galeri</a><a href="#rsvp">RSVP</a>
    </motion.nav>

    <section className="hero theatre-scene">
      <motion.div className="hero-media" style={{ y: reduced ? 0 : heroImageY, backgroundImage: `linear-gradient(180deg, rgba(20,12,7,.38), rgba(20,12,7,.67) 48%, rgba(20,12,7,.95)), url(${coverOf(wedding) || FALLBACK_COVER})` }}/>
      <StageSet variant="photo"/>
      <motion.div className="hero-copy" style={{ y: reduced ? 0 : heroY, opacity: reduced ? 1 : heroFade }}>
        <motion.div className="hero-copy-inner" initial={reduced ? false : { opacity: 0, y: 44, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.1, ease: EASE }}>
        <div className="hero-ornament"><Ornament/></div>
        <p>Dengan hormat kami mengundang</p>
        <h1>{couple(wedding)}</h1>
        <Divider/>
        <time dateTime={wedding.event_date}>{fullDate(wedding.event_date)}</time>
        <a className="text-action" href={calendarUrl} target="_blank" rel="noreferrer"><CalendarDays size={18}/> Simpan tanggal</a>
        </motion.div>
      </motion.div>
      <a className="scroll-cue" href="#pembuka" aria-label="Lanjut ke isi undangan"><ChevronDown/></a>
    </section>

    <section id="pembuka" className="verse section-pad theatre-paper">
      <Reveal>
        <Ornament/>
        <blockquote>“Dan di antara tanda-tanda kebesaran-Nya ialah Dia menciptakan pasangan-pasangan untukmu agar kamu merasa tenteram kepadanya, dan Dia menjadikan di antaramu rasa kasih dan sayang.”</blockquote>
        <p>QS. Ar-Rum: 21</p>
      </Reveal>
    </section>

    <SceneDivider label="Sowan"/>

    <section className="couple-section section-pad theatre-paper">
      <Reveal className="section-heading"><span>Kedua mempelai</span><h2>Satu perjalanan,<br/>satu tujuan</h2></Reveal>
      <Reveal className="couple-portrait"><img src={coverOf(wedding) || FALLBACK_COVER} alt={coverOf(wedding) ? `Potret ${couple(wedding)}` : 'Panggung pagelaran wayang kulit, foto Kassian Cephas'}/><span className="portrait-stamp"><Ornament/></span></Reveal>
      <Reveal className="couple-names">
        <article><span>01</span><h3>{wedding.bride}</h3><p>Mempelai wanita</p></article>
        <i>&</i>
        <article><span>02</span><h3>{wedding.groom}</h3><p>Mempelai pria</p></article>
      </Reveal>
      <Reveal className="story"><p>{wedding.story || 'Dengan penuh syukur, kami mengundang Anda untuk menjadi bagian dari hari bahagia kami.'}</p></Reveal>
    </section>

    <section id="acara" className="event-section section-pad theatre-scene dark-stage">
      <StageSet variant="dark"/>
      <Reveal className="event-intro"><p>Save the date</p><h2>{fullDate(wedding.event_date)}</h2><Countdown target={wedding.event_date}/></Reveal>
      <div className="event-list">
        {sessions.map((session, index) => <Reveal key={session.id} delay={index * .12}>
          <article>
            <span className="event-number">{String(index + 1).padStart(2, '0')}</span>
            <div><p className="event-label">Rangkaian acara</p><h3>{session.label}</h3></div>
            <dl>
              <div><dt><Clock3 size={18}/> Waktu</dt><dd>{clock(session.start_time)} – {clock(session.end_time)} WIB</dd></div>
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

    <SceneDivider label="Gebyog"/>

    <section id="galeri" className="gallery-section section-pad theatre-scene dark-stage">
      <StageSet variant="dark"/>
      <Reveal className="section-heading light"><span>Potongan cerita</span><h2>Dalam bingkai,<br/>selamanya</h2></Reveal>
      <div className="gallery-grid">
        {gallery.map((image, index) => <motion.button key={image.url}
          initial={reduced ? false : { opacity: 1, scale: .94, rotate: index % 2 ? 1.5 : -1.5, y: 46 }}
          whileInView={{ opacity: 1, scale: 1, rotate: 0, y: 0 }} viewport={{ once: true, amount: .12 }}
          whileHover={reduced ? undefined : { scale: 1.025, zIndex: 2 }} transition={{ duration: .9, delay: index * .07, ease: EASE }}
          onClick={event => { triggerRef.current = event.currentTarget; setLightbox(index); }} aria-label={`Perbesar foto galeri ${index + 1}`}>
          <img src={image.url} alt={image.alt} loading="lazy" decoding="async"/><span>{String(index + 1).padStart(2, '0')}</span>
        </motion.button>)}
      </div>
    </section>

    <section id="rsvp" className="rsvp-section section-pad theatre-paper">
      <Reveal className="rsvp-intro">
        <span>Konfirmasi kehadiran</span>
        <h2>Hadirmu melengkapi cerita kami.</h2>
        <p>Mohon isi konfirmasi agar kami dapat menyambutmu dengan baik.</p>
        {deadline && <p className={`deadline ${closed ? 'closed' : ''}`}><strong>{closed ? 'Konfirmasi telah ditutup' : 'Konfirmasi ditutup'}</strong> {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(deadline)}</p>}
        <Divider/>
      </Reveal>
      <Reveal className="rsvp-panel">
        <AnimatePresence mode="wait">
          {closed ? <motion.div key="closed" className="thanks" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Clock3/><h3>Konfirmasi ditutup</h3><p>Batas konfirmasi sudah lewat. Silakan hubungi kami langsung bila perlu menambah tamu.</p>
          </motion.div> : done ? <motion.div key="done" className="thanks" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}>
            <Check/><h3>Terima kasih</h3><p>Konfirmasi kehadiranmu sudah kami terima dan tercatat. Hubungi kami bila ada perubahan.</p>
          </motion.div> : <motion.form key="form" onSubmit={handleSubmit(submit)} noValidate exit={{ opacity: 0 }}>
            <label>Nama lengkap<input autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'rsvp-name-error' : undefined} {...register('name', { required: 'Nama wajib diisi', maxLength: { value: 100, message: 'Maksimal 100 karakter' } })}/>{errors.name && <small id="rsvp-name-error" className="field-error" role="alert">{errors.name.message}</small>}</label>
            <fieldset>
              <legend>Apakah Anda akan hadir?</legend>
              <div className="attendance-options">
                {([['yes', 'Hadir'], ['maybe', 'Mungkin'], ['no', 'Tidak hadir']] as const).map(([value, label]) => <label key={value}><input type="radio" value={value} {...register('attendance')}/><span>{label}</span></label>)}
              </div>
            </fieldset>
            {attending && <div className="form-row">
              {sessions.length > 0 && <label>Sesi acara<select aria-invalid={Boolean(errors.session_id)} {...register('session_id', { required: 'Pilih sesi acara' })}><option value="">Pilih sesi</option>{sessions.map(session => <option key={session.id} value={session.id}>{session.label}, {clock(session.start_time)}</option>)}</select>{errors.session_id && <small className="field-error" role="alert">{errors.session_id.message}</small>}</label>}
              <label>Jumlah tamu (termasuk Anda)<input type="number" min="1" max="20" aria-invalid={Boolean(errors.guests_count)} {...register('guests_count', { valueAsNumber: true, min: { value: 1, message: 'Minimal 1 tamu' }, max: { value: 20, message: 'Maksimal 20 tamu' } })}/>{errors.guests_count && <small className="field-error" role="alert">{errors.guests_count.message}</small>}</label>
            </div>}
            <label>Ucapan atau doa — opsional<textarea rows={4} maxLength={500} {...register('message')} placeholder="Tuliskan doa terbaikmu..."/></label>
            <Alert notice={notice}/>
            <Btn className="ink" disabled={isSubmitting}>{isSubmitting ? 'Mengirim...' : 'Kirim konfirmasi'}</Btn>
          </motion.form>}
        </AnimatePresence>
      </Reveal>
    </section>

    <footer className="theatre-scene dark-stage">
      <Ornament/>
      <p>Atas kehadiran dan doa restu Anda, kami mengucapkan terima kasih.</p>
      <h2>{couple(wedding)}</h2>
      <small>Sowan.</small>
      <small className="asset-credit">Artefak wayang Arjuna &amp; Bima: Collectie Wereldmuseum, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA</a>. Foto pagelaran: Kassian Cephas, public domain.</small>
    </footer>

    <AnimatePresence>
      {lightbox !== undefined && <Lightbox images={gallery} index={lightbox} onClose={closeLightbox} onStep={delta => setLightbox(current => current === undefined ? current : (current + delta + gallery.length) % gallery.length)}/>}
    </AnimatePresence>
  </motion.main>;
}

export default Public;
