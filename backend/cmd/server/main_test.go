package main

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRSVPRateLimitSixthRequestIs429(t *testing.T) {
	gin.SetMode(gin.TestMode)
	app := &App{}
	router := gin.New()
	router.POST("/w/:slug/rsvp", app.rateLimit(), func(c *gin.Context) { c.Status(http.StatusCreated) })
	for i := 0; i < 5; i++ {
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
