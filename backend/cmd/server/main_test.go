package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func TestRateLimitUsesConfiguredLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := &App{}
	router := gin.New()
	router.POST("/w/:slug/rsvp", app.rateLimit(2), func(c *gin.Context) { c.Status(http.StatusCreated) })
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest(http.MethodPost, "/w/demo/rsvp", nil)
		req.RemoteAddr = "192.0.2.1:1234"
		got := httptest.NewRecorder()
		router.ServeHTTP(got, req)
		if got.Code != http.StatusCreated {
			t.Fatalf("request %d: got %d", i+1, got.Code)
		}
	}
	req := httptest.NewRequest(http.MethodPost, "/w/demo/rsvp", nil)
	req.RemoteAddr = "192.0.2.1:1234"
	got := httptest.NewRecorder()
	router.ServeHTTP(got, req)
	if got.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", got.Code)
	}
	if got.Header().Get("Retry-After") == "" {
		t.Fatal("429 must carry Retry-After")
	}
}

func TestRSVPRateLimitIsolatesClients(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := &App{}
	router := gin.New()
	router.POST("/w/:slug/rsvp", app.rateLimit(1), func(c *gin.Context) { c.Status(http.StatusCreated) })
	for _, addr := range []string{"192.0.2.1:1", "192.0.2.2:1"} {
		req := httptest.NewRequest(http.MethodPost, "/w/demo/rsvp", nil)
		req.RemoteAddr = addr
		got := httptest.NewRecorder()
		router.ServeHTTP(got, req)
		if got.Code != http.StatusCreated {
			t.Fatalf("%s: got %d", addr, got.Code)
		}
	}
}

func TestValidSessionWindowRejectsBadChronologyAndOverlap(t *testing.T) {
	base := time.Date(2026, 5, 1, 9, 0, 0, 0, time.UTC)
	existing := []WeddingSession{{ID: 1, Label: "Akad", StartTime: base, EndTime: base.Add(2 * time.Hour)}}
	if err := validSessionWindow(base.Add(time.Hour), base, existing); err == nil {
		t.Fatal("end before start must fail")
	}
	if err := validSessionWindow(base.Add(time.Hour), base.Add(3*time.Hour), existing); err == nil {
		t.Fatal("overlap must fail")
	}
	if err := validSessionWindow(base.Add(3*time.Hour), base.Add(5*time.Hour), existing); err != nil {
		t.Fatalf("adjacent session must pass: %v", err)
	}
}

func TestCheckInTokenIsScopedToItsWedding(t *testing.T) {
	app := &App{secret: []byte("0123456789abcdef0123456789abcdef")}
	raw, err := app.checkInToken(7)
	if err != nil {
		t.Fatal(err)
	}
	if !app.validateCheckInToken(raw, 7) {
		t.Fatal("own wedding must validate")
	}
	if app.validateCheckInToken(raw, 8) {
		t.Fatal("other wedding must not validate")
	}
	if app.validateCheckInToken("", 7) || app.validateCheckInToken("garbage", 7) {
		t.Fatal("missing or garbage token must not validate")
	}
	// Token organizer tidak boleh dipakai untuk check-in publik.
	other, err := app.token(7)
	if err != nil {
		t.Fatal(err)
	}
	if app.validateCheckInToken(other, 7) {
		t.Fatal("organizer token must not be a check-in token")
	}
}

func TestWeddingUploadPathIsConfinedPerWedding(t *testing.T) {
	path, err := weddingUploadPath(t.TempDir(), 42, "gallery", "photo.webp")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(filepath.ToSlash(path), "weddings/42/gallery/photo.webp") {
		t.Fatalf("got %q", path)
	}
	if _, err := weddingUploadPath(t.TempDir(), 42, "gallery", "../../escape.webp"); err == nil {
		t.Fatal("path traversal must fail")
	}
	if _, err := weddingUploadPath(t.TempDir(), 42, "avatar", "photo.webp"); err == nil {
		t.Fatal("unknown image kind must fail")
	}
}

func TestValidateImageRejectsUnsupportedTypeAndSize(t *testing.T) {
	if err := validateImage("image/webp", 1024); err != nil {
		t.Fatal(err)
	}
	if err := validateImage("application/pdf", 1024); err == nil {
		t.Fatal("pdf must fail")
	}
	if err := validateImage("image/jpeg", maxUploadBytes+1); err == nil {
		t.Fatal("oversized upload must fail")
	}
}

func TestCheckInSearchRequiresThreeCharacters(t *testing.T) {
	if err := validSearchQuery("an"); err == nil {
		t.Fatal("short query must fail")
	}
	if err := validSearchQuery("  Ani "); err != nil {
		t.Fatal(err)
	}
}
