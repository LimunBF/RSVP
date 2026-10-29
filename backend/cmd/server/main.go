package main

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;size:255" json:"email"`
	PasswordHash string    `json:"-"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
}
type Wedding struct {
	ID          uint             `gorm:"primaryKey" json:"id"`
	OrganizerID uint             `json:"organizer_id"`
	Slug        string           `gorm:"uniqueIndex;size:100" json:"slug"`
	Bride       string           `json:"bride"`
	Groom       string           `json:"groom"`
	EventDate   time.Time        `json:"event_date"`
	Location    string           `json:"location"`
	Story       string           `json:"story"`
	CoverURL    string           `json:"cover_url"`
	Deadline    *time.Time       `json:"deadline"`
	Sessions    []WeddingSession `gorm:"constraint:OnDelete:CASCADE;" json:"sessions"`
	Images      []WeddingImage   `gorm:"constraint:OnDelete:CASCADE;" json:"images"`
	RSVPs       []RSVP           `gorm:"constraint:OnDelete:CASCADE;" json:"-"`
	CreatedAt   time.Time        `json:"created_at"`
}
type WeddingSession struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	WeddingID uint      `json:"wedding_id"`
	Label     string    `json:"label"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	SortOrder int       `json:"sort_order"`
}
type RSVP struct {
	ID          uint            `gorm:"primaryKey" json:"id"`
	WeddingID   uint            `gorm:"index;not null" json:"wedding_id"`
	SessionID   *uint           `json:"session_id"`
	Session     *WeddingSession `json:"session,omitempty"`
	Name        string          `gorm:"size:100;index;not null" json:"name"`
	Attendance  string          `gorm:"size:10;check:attendance IN ('yes','no','maybe')" json:"attendance"`
	GuestsCount int             `gorm:"check:guests_count >= 0" json:"guests_count"`
	Message     string          `gorm:"size:500" json:"message"`
	CheckedInAt *time.Time      `json:"checked_in_at"`
	CreatedAt   time.Time       `json:"created_at"`
}
type WeddingImage struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	WeddingID    uint      `gorm:"index;not null" json:"wedding_id"`
	Kind         string    `gorm:"size:20;not null;check:kind IN ('cover','gallery')" json:"kind"`
	Path         string    `gorm:"size:500;not null" json:"path"`
	OriginalName string    `gorm:"size:255" json:"original_name"`
	MimeType     string    `gorm:"size:50" json:"mime_type"`
	FileSize     int64     `json:"file_size"`
	SortOrder    int       `json:"sort_order"`
	AltText      string    `gorm:"size:255" json:"alt_text"`
	CreatedAt    time.Time `json:"created_at"`
}
type App struct {
	db         *gorm.DB
	secret     []byte
	uploadRoot string
}
type authInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name"`
}
type weddingInput struct {
	Bride     string `json:"bride" binding:"required,max=100"`
	Groom     string `json:"groom" binding:"required,max=100"`
	Slug      string `json:"slug" binding:"required,max=100"`
	EventDate string `json:"event_date" binding:"required"`
	Location  string `json:"location" binding:"required,max=255"`
	Story     string `json:"story" binding:"max=3000"`
	CoverURL  string `json:"cover_url" binding:"omitempty,url"`
	Deadline  string `json:"deadline"`
}
type sessionInput struct {
	Label     string `json:"label" binding:"required,max=100"`
	StartTime string `json:"start_time" binding:"required"`
	EndTime   string `json:"end_time" binding:"required"`
}
type rsvpInput struct {
	Name        string `json:"name" binding:"required,max=100"`
	Attendance  string `json:"attendance" binding:"required,oneof=yes no maybe"`
	SessionID   *uint  `json:"session_id"`
	GuestsCount int    `json:"guests_count" binding:"min=0,max=20"`
	Message     string `json:"message" binding:"max=500"`
}

const maxUploadBytes int64 = 8 << 20

func fail(c *gin.Context, status int, msg string) { c.JSON(status, gin.H{"error": msg}) }
func validSearchQuery(q string) error {
	if len([]rune(strings.TrimSpace(q))) < 3 {
		return errors.New("ketik minimal 3 karakter")
	}
	return nil
}
func validateImage(mime string, size int64) error {
	if size <= 0 || size > maxUploadBytes {
		return errors.New("ukuran foto maksimal 8 MB")
	}
	if mime != "image/jpeg" && mime != "image/png" && mime != "image/webp" {
		return errors.New("format foto harus JPG, PNG, atau WebP")
	}
	return nil
}
func weddingUploadPath(root string, weddingID uint, kind, name string) (string, error) {
	if kind != "cover" && kind != "gallery" {
		return "", errors.New("jenis foto tidak valid")
	}
	if filepath.Base(name) != name || name == "." || name == "" {
		return "", errors.New("nama file tidak valid")
	}
	return filepath.Join(root, "weddings", strconv.Itoa(int(weddingID)), kind, name), nil
}
func parseTime(s string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339, "2006-01-02", "2006-01-02T15:04"} {
		if t, e := time.Parse(layout, s); e == nil {
			return t, nil
		}
	}
	return time.Time{}, errors.New("invalid time")
}
func (a *App) token(id uint) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": strconv.Itoa(int(id)), "exp": time.Now().Add(24 * time.Hour).Unix()}).SignedString(a.secret)
}
func (a *App) auth(c *gin.Context) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		fail(c, 401, "Unauthorized")
		c.Abort()
		return
	}
	t, e := jwt.Parse(strings.TrimPrefix(header, "Bearer "), func(t *jwt.Token) (any, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("alg")
		}
		return a.secret, nil
	})
	if e != nil || !t.Valid {
		fail(c, 401, "Unauthorized")
		c.Abort()
		return
	}
	claims, ok := t.Claims.(jwt.MapClaims)
	sub, okSub := claims["sub"].(string)
	id, e := strconv.Atoi(sub)
	if !ok || !okSub || e != nil || id <= 0 {
		fail(c, 401, "Unauthorized")
		c.Abort()
		return
	}
	c.Set("uid", uint(id))
}
func uid(c *gin.Context) uint { v, _ := c.Get("uid"); return v.(uint) }
func main() {
	_ = godotenv.Load()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=rsvp password=rsvp dbname=rsvp port=5432 sslmode=disable"
	}
	db, e := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if e != nil {
		panic(e)
	}
	if e = db.AutoMigrate(&User{}, &Wedding{}, &WeddingSession{}, &RSVP{}, &WeddingImage{}); e != nil {
		panic(e)
	}
	secret := os.Getenv("JWT_SECRET")
	if len(secret) < 32 {
		panic("JWT_SECRET wajib diisi minimal 32 karakter")
	}
	uploadRoot := getenv("UPLOAD_DIR", "./uploads")
	if e = os.MkdirAll(uploadRoot, 0o755); e != nil {
		panic(e)
	}
	a := &App{db: db, secret: []byte(secret), uploadRoot: uploadRoot}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(func(c *gin.Context) {
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Content-Security-Policy", "default-src 'self'")
		c.Next()
	})
	_ = r.SetTrustedProxies(nil)
	r.Use(cors.New(cors.Config{AllowOrigins: strings.Split(getenv("FRONTEND_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"), ","), AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}, AllowHeaders: []string{"Origin", "Content-Type", "Authorization"}}))
	r.GET("/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })
	auth := r.Group("/auth")
	auth.POST("/register", a.register)
	auth.POST("/login", a.login)
	r.GET("/w/:slug", a.publicWedding)
	r.POST("/w/:slug/rsvp", a.rateLimit(), a.publicRSVP)
	r.GET("/w/:slug/check-in/search", a.rateLimit(), a.checkInSearch)
	r.POST("/w/:slug/check-in", a.rateLimit(), a.checkIn)
	r.Static("/uploads", getenv("UPLOAD_DIR", "./uploads"))
	p := r.Group("/api")
	p.Use(a.auth)
	p.GET("/weddings", a.listWeddings)
	p.POST("/weddings", a.createWedding)
	p.PUT("/weddings/:id", a.updateWedding)
	p.DELETE("/weddings/:id", a.deleteWedding)
	p.POST("/weddings/:id/sessions", a.addSession)
	p.DELETE("/weddings/:id/sessions/:sid", a.deleteSession)
	p.GET("/weddings/:id/rsvps", a.listRSVPs)
	p.POST("/weddings/:id/rsvps/:rid/check-in", a.manualCheckIn)
	p.DELETE("/weddings/:id/rsvps/:rid/check-in", a.undoCheckIn)
	p.POST("/weddings/:id/images", a.uploadImage)
	p.DELETE("/weddings/:id/images/:iid", a.deleteImage)
	port := getenv("PORT", "8080")
	r.Run(":" + port)
}
func getenv(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}
func (a *App) register(c *gin.Context) {
	var in authInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Input tidak valid")
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	h, e := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if e != nil {
		fail(c, 500, "Gagal membuat akun")
		return
	}
	u := User{Email: in.Email, PasswordHash: string(h), Name: in.Name}
	if e = a.db.Create(&u).Error; e != nil {
		fail(c, 409, "Email sudah terdaftar")
		return
	}
	tok, _ := a.token(u.ID)
	c.JSON(201, gin.H{"token": tok, "user": u})
}
func (a *App) login(c *gin.Context) {
	var in authInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Input tidak valid")
		return
	}
	var u User
	if a.db.Where("email = ?", strings.ToLower(in.Email)).First(&u).Error != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) != nil {
		fail(c, 401, "Kredensial tidak valid")
		return
	}
	tok, _ := a.token(u.ID)
	c.JSON(200, gin.H{"token": tok, "user": u})
}
func weddingFrom(a *App, c *gin.Context) (Wedding, bool) {
	var w Wedding
	if a.db.Preload("Sessions", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Preload("Images", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Where("id = ? AND organizer_id = ?", c.Param("id"), uid(c)).First(&w).Error != nil {
		fail(c, 404, "Undangan tidak ditemukan")
		return w, false
	}
	return w, true
}
func (a *App) listWeddings(c *gin.Context) {
	var w []Wedding
	a.db.Preload("Sessions", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Preload("Images", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Where("organizer_id = ?", uid(c)).Find(&w)
	c.JSON(200, w)
}
func (a *App) createWedding(c *gin.Context) {
	var in weddingInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Input tidak valid")
		return
	}
	date, e := parseTime(in.EventDate)
	if e != nil {
		fail(c, 400, "Tanggal tidak valid")
		return
	}
	w := Wedding{OrganizerID: uid(c), Slug: in.Slug, Bride: in.Bride, Groom: in.Groom, EventDate: date, Location: in.Location, Story: in.Story, CoverURL: in.CoverURL}
	if in.Deadline != "" {
		t, _ := parseTime(in.Deadline)
		w.Deadline = &t
	}
	if a.db.Create(&w).Error != nil {
		fail(c, 409, "Slug sudah digunakan")
		return
	}
	c.JSON(201, w)
}
func (a *App) updateWedding(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	var in weddingInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Input tidak valid")
		return
	}
	date, e := parseTime(in.EventDate)
	if e != nil {
		fail(c, 400, "Tanggal tidak valid")
		return
	}
	var deadline *time.Time
	if in.Deadline != "" {
		t, err := parseTime(in.Deadline)
		if err != nil {
			fail(c, 400, "Batas RSVP tidak valid")
			return
		}
		deadline = &t
	}
	w.Bride, w.Groom, w.Slug, w.Location, w.Story, w.EventDate, w.Deadline = strings.TrimSpace(in.Bride), strings.TrimSpace(in.Groom), strings.TrimSpace(in.Slug), strings.TrimSpace(in.Location), strings.TrimSpace(in.Story), date, deadline
	if in.CoverURL != "" {
		w.CoverURL = in.CoverURL
	}
	if e = a.db.Save(&w).Error; e != nil {
		fail(c, 409, "Slug sudah digunakan atau perubahan gagal")
		return
	}
	c.JSON(200, w)
}
func (a *App) deleteWedding(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	a.db.Delete(&w)
	c.Status(204)
}
func (a *App) addSession(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	var in sessionInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Input tidak valid")
		return
	}
	if len(w.Sessions) >= 3 {
		fail(c, 400, "Maksimal 3 sesi")
		return
	}
	st, e1 := parseTime(in.StartTime)
	et, e2 := parseTime(in.EndTime)
	if e1 != nil || e2 != nil {
		fail(c, 400, "Waktu tidak valid")
		return
	}
	s := WeddingSession{WeddingID: w.ID, Label: in.Label, StartTime: st, EndTime: et, SortOrder: len(w.Sessions)}
	a.db.Create(&s)
	c.JSON(201, s)
}
func (a *App) deleteSession(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	a.db.Where("id = ? AND wedding_id = ?", c.Param("sid"), w.ID).Delete(&WeddingSession{})
	c.Status(204)
}
func (a *App) publicWedding(c *gin.Context) {
	var w Wedding
	if a.db.Preload("Sessions", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Preload("Images", func(db *gorm.DB) *gorm.DB { return db.Order("sort_order") }).Where("slug = ?", c.Param("slug")).First(&w).Error != nil {
		fail(c, 404, "Undangan tidak ditemukan")
		return
	}
	c.JSON(200, w)
}
func (a *App) publicRSVP(c *gin.Context) {
	var w Wedding
	if a.db.Where("slug = ?", c.Param("slug")).First(&w).Error != nil {
		fail(c, 404, "Undangan tidak ditemukan")
		return
	}
	var in rsvpInput
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Data RSVP tidak valid")
		return
	}
	if in.Attendance != "yes" {
		in.SessionID = nil
		in.GuestsCount = 0
	}
	if in.Attendance == "yes" && (in.SessionID == nil || a.db.Where("id = ? AND wedding_id = ?", *in.SessionID, w.ID).First(&WeddingSession{}).Error != nil) {
		fail(c, 400, "Sesi tidak valid")
		return
	}
	r := RSVP{WeddingID: w.ID, SessionID: in.SessionID, Name: in.Name, Attendance: in.Attendance, GuestsCount: in.GuestsCount, Message: in.Message}
	a.db.Create(&r)
	c.JSON(201, gin.H{"message": "RSVP berhasil disimpan"})
}
func (a *App) listRSVPs(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	var rows []RSVP
	a.db.Preload("Session").Where("wedding_id = ?", w.ID).Order("created_at desc").Find(&rows)
	var stats = gin.H{"total": len(rows), "yes": 0, "no": 0, "maybe": 0, "guests": 0}
	for _, r := range rows {
		stats[r.Attendance] = stats[r.Attendance].(int) + 1
		stats["guests"] = stats["guests"].(int) + r.GuestsCount
	}
	c.JSON(200, gin.H{"rsvps": rows, "stats": stats})
}

func (a *App) checkInSearch(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if e := validSearchQuery(q); e != nil {
		fail(c, 400, e.Error())
		return
	}
	var w Wedding
	if e := a.db.Where("slug = ?", c.Param("slug")).First(&w).Error; e != nil {
		fail(c, 404, "Undangan tidak ditemukan")
		return
	}
	var rows []RSVP
	if e := a.db.Select("id", "name", "guests_count", "checked_in_at").Where("wedding_id = ? AND attendance = ? AND name ILIKE ?", w.ID, "yes", q+"%").Order("name").Limit(5).Find(&rows).Error; e != nil {
		fail(c, 500, "Gagal mencari tamu")
		return
	}
	c.JSON(200, gin.H{"results": rows})
}
func (a *App) checkIn(c *gin.Context) {
	var in struct {
		RSVPID uint `json:"rsvp_id" binding:"required"`
	}
	if c.ShouldBindJSON(&in) != nil {
		fail(c, 400, "Pilih nama tamu")
		return
	}
	var w Wedding
	if e := a.db.Where("slug = ?", c.Param("slug")).First(&w).Error; e != nil {
		fail(c, 404, "Undangan tidak ditemukan")
		return
	}
	now := time.Now()
	result := a.db.Model(&RSVP{}).Where("id = ? AND wedding_id = ? AND attendance = ? AND checked_in_at IS NULL", in.RSVPID, w.ID, "yes").Update("checked_in_at", now)
	if result.Error != nil {
		fail(c, 500, "Check-in gagal")
		return
	}
	if result.RowsAffected == 0 {
		fail(c, 409, "Tamu tidak ditemukan atau sudah check-in")
		return
	}
	c.JSON(200, gin.H{"message": "Check-in berhasil", "checked_in_at": now})
}
func (a *App) manualCheckIn(c *gin.Context) { a.setOrganizerCheckIn(c, true) }
func (a *App) undoCheckIn(c *gin.Context)   { a.setOrganizerCheckIn(c, false) }
func (a *App) setOrganizerCheckIn(c *gin.Context, present bool) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	updates := map[string]any{"checked_in_at": nil}
	if present {
		updates["checked_in_at"] = time.Now()
	}
	result := a.db.Model(&RSVP{}).Where("id = ? AND wedding_id = ? AND attendance = ?", c.Param("rid"), w.ID, "yes").Updates(updates)
	if result.Error != nil {
		fail(c, 500, "Absensi gagal diperbarui")
		return
	}
	if result.RowsAffected == 0 {
		fail(c, 404, "Tamu tidak ditemukan")
		return
	}
	c.JSON(200, gin.H{"message": "Absensi diperbarui"})
}
func (a *App) uploadImage(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	kind := c.PostForm("kind")
	file, e := c.FormFile("file")
	if e != nil {
		fail(c, 400, "Pilih foto")
		return
	}
	opened, e := file.Open()
	if e != nil {
		fail(c, 400, "Foto tidak dapat dibaca")
		return
	}
	defer opened.Close()
	header := make([]byte, 512)
	n, e := opened.Read(header)
	if e != nil && e != io.EOF {
		fail(c, 400, "Foto tidak dapat dibaca")
		return
	}
	mime := http.DetectContentType(header[:n])
	if e = validateImage(mime, file.Size); e != nil {
		fail(c, 400, e.Error())
		return
	}
	ext := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime]
	name := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	destination, e := weddingUploadPath(a.uploadRoot, w.ID, kind, name)
	if e != nil {
		fail(c, 400, e.Error())
		return
	}
	if kind == "cover" {
		var old []WeddingImage
		if e = a.db.Where("wedding_id = ? AND kind = ?", w.ID, "cover").Find(&old).Error; e != nil {
			fail(c, 500, "Gagal membaca cover lama")
			return
		}
		for _, image := range old {
			_ = os.Remove(filepath.Join(a.uploadRoot, filepath.FromSlash(strings.TrimPrefix(image.Path, "/uploads/"))))
		}
		if e = a.db.Where("wedding_id = ? AND kind = ?", w.ID, "cover").Delete(&WeddingImage{}).Error; e != nil {
			fail(c, 500, "Gagal mengganti cover")
			return
		}
	}
	if e = os.MkdirAll(filepath.Dir(destination), 0o755); e != nil {
		fail(c, 500, "Folder foto gagal dibuat")
		return
	}
	if e = c.SaveUploadedFile(file, destination); e != nil {
		fail(c, 500, "Foto gagal disimpan")
		return
	}
	var count int64
	a.db.Model(&WeddingImage{}).Where("wedding_id = ? AND kind = ?", w.ID, kind).Count(&count)
	image := WeddingImage{WeddingID: w.ID, Kind: kind, Path: "/uploads/weddings/" + strconv.Itoa(int(w.ID)) + "/" + kind + "/" + name, OriginalName: filepath.Base(file.Filename), MimeType: mime, FileSize: file.Size, SortOrder: int(count), AltText: strings.TrimSpace(c.PostForm("alt_text"))}
	if e = a.db.Create(&image).Error; e != nil {
		_ = os.Remove(destination)
		fail(c, 500, "Metadata foto gagal disimpan")
		return
	}
	if kind == "cover" {
		_ = a.db.Model(&w).Update("cover_url", image.Path).Error
	}
	c.JSON(201, image)
}
func (a *App) deleteImage(c *gin.Context) {
	w, ok := weddingFrom(a, c)
	if !ok {
		return
	}
	var image WeddingImage
	if e := a.db.Where("id = ? AND wedding_id = ?", c.Param("iid"), w.ID).First(&image).Error; e != nil {
		fail(c, 404, "Foto tidak ditemukan")
		return
	}
	if e := a.db.Delete(&image).Error; e != nil {
		fail(c, 500, "Foto gagal dihapus")
		return
	}
	_ = os.Remove(filepath.Join(a.uploadRoot, filepath.FromSlash(strings.TrimPrefix(image.Path, "/uploads/"))))
	if image.Kind == "cover" {
		_ = a.db.Model(&w).Update("cover_url", "").Error
	}
	c.Status(204)
}

type limiter struct {
	sync.Mutex
	hits map[string][]time.Time
}

func (a *App) rateLimit() gin.HandlerFunc {
	l := &limiter{hits: map[string][]time.Time{}}
	return func(c *gin.Context) {
		ip := c.ClientIP()
		l.Lock()
		now := time.Now()
		xs := l.hits[ip]
		cut := now.Add(-time.Minute)
		j := 0
		for _, t := range xs {
			if t.After(cut) {
				xs[j] = t
				j++
			}
		}
		xs = xs[:j]
		if len(xs) >= 5 {
			l.hits[ip] = xs
			l.Unlock()
			fail(c, 429, "Terlalu banyak permintaan")
			c.Abort()
			return
		}
		l.hits[ip] = append(xs, now)
		l.Unlock()
		c.Next()
	}
}
