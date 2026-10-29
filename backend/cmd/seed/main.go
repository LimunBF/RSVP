package main

import (
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"time"
)

type User struct {
	ID           uint   `gorm:"primaryKey"`
	Email        string `gorm:"uniqueIndex"`
	PasswordHash string
	Name         string
	CreatedAt    time.Time
}
type Wedding struct {
	ID          uint `gorm:"primaryKey"`
	OrganizerID uint
	Slug        string `gorm:"uniqueIndex"`
	Bride       string
	Groom       string
	EventDate   time.Time
	Location    string
	Story       string
	CoverURL    string
	Deadline    *time.Time
	CreatedAt   time.Time
}
type WeddingSession struct {
	ID        uint `gorm:"primaryKey"`
	WeddingID uint
	Label     string
	StartTime time.Time
	EndTime   time.Time
	SortOrder int
}
type RSVP struct {
	ID          uint `gorm:"primaryKey"`
	WeddingID   uint
	SessionID   *uint
	Name        string
	Attendance  string
	GuestsCount int
	Message     string
	CreatedAt   time.Time
}

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "host=localhost user=rsvp password=rsvp dbname=rsvp port=5432 sslmode=disable"
	}
	db, e := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if e != nil {
		panic(e)
	}
	db.AutoMigrate(&User{}, &Wedding{}, &WeddingSession{}, &RSVP{})
	hash, _ := bcrypt.GenerateFromPassword([]byte("demopassword"), bcrypt.DefaultCost)
	u := User{Email: "demo@rsvp.local", Name: "Demo Organizer", PasswordHash: string(hash)}
	db.Where(User{Email: u.Email}).FirstOrCreate(&u)
	w := Wedding{OrganizerID: u.ID, Slug: "anisa-bima", Bride: "Anisa", Groom: "Bima", EventDate: time.Date(2027, 6, 12, 0, 0, 0, 0, time.UTC), Location: "Pendopo Mataram, Yogyakarta", Story: "Dengan penuh syukur, kami mengundang Anda untuk menjadi bagian dari hari bahagia kami."}
	db.Where(Wedding{Slug: w.Slug}).FirstOrCreate(&w)
	start := time.Date(2027, 6, 12, 10, 0, 0, 0, time.UTC)
	s := WeddingSession{WeddingID: w.ID, Label: "Akad Nikah", StartTime: start, EndTime: start.Add(time.Hour), SortOrder: 0}
	db.Where(WeddingSession{WeddingID: w.ID, Label: s.Label}).FirstOrCreate(&s)
	fmt.Println("Seed done: demo@rsvp.local / demopassword; /w/anisa-bima")
}
