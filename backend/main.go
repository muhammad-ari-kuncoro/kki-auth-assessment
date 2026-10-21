	package main

	import (
		"context"
		"crypto/rand"
		"database/sql"
		"encoding/hex"
		"encoding/json"
		"fmt"
		"log"
		"net/http"
		"strconv"
		"strings"
		"time"

		"github.com/go-chi/chi/v5"
		"github.com/go-chi/chi/v5/middleware"
		"github.com/go-chi/cors"
		_ "github.com/lib/pq"
		"golang.org/x/crypto/bcrypt"
	)

	var db *sql.DB

	type User struct {
		ID        int       `json:"id"`
		Username  string    `json:"username"`
		Email     string    `json:"email"`
		Password  string    `json:"password,omitempty"`
		Role      string    `json:"role"`
		CreatedAt time.Time `json:"created_at"`
	}

	type UserWithSessionCount struct {
		ID             int       `json:"id"`
		Username       string    `json:"username"`
		Email          string    `json:"email"`
		Role           string    `json:"role"`
		CreatedAt      time.Time `json:"created_at"`
		ActiveSessions int       `json:"active_sessions"`
	}

	type RegisterRequest struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	type LoginRequest struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}

	type contextKey string

	const userCtxKey contextKey = "user"

	func main() {
		var err error
		connStr := "host=127.0.0.1 port=5434 user=postgres password=postgres dbname=auth_db sslmode=disable"
		db, err = sql.Open("postgres", connStr)
		if err != nil {
			log.Fatalf("Error driver DB: %v", err)
		}
		defer db.Close()

		if err := db.Ping(); err != nil {
			log.Fatalf("Gagal terhubung ke DB: %v", err)
		}
		fmt.Println("Sukses terhubung ke PostgreSQL.")

		r := chi.NewRouter()
		r.Use(middleware.Logger)
		r.Use(middleware.Recoverer)
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"http://localhost:5173", "http://127.0.0.1:5173"},
			AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
			AllowCredentials: true,
		}))

		// Public Routes
		r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{"status":"ok"}`))
		})
		r.Post("/api/register", handleRegister)
		r.Post("/api/login", handleLogin)

		// Protected Routes (Perlu Login)
		r.Group(func(protected chi.Router) {
			protected.Use(authMiddleware)
			protected.Get("/api/profile", handleProfile)
			protected.Post("/api/logout", handleLogout)

			// Admin Only Routes
			protected.Group(func(admin chi.Router) {
				admin.Use(adminOnlyMiddleware)
				admin.Get("/api/admin/users", handleAdminGetUsers)
				admin.Post("/api/admin/users/{id}/force-logout", handleAdminForceLogout)
			})
		})

		fmt.Println("Server backend berjalan di http://localhost:8080...")
		log.Fatal(http.ListenAndServe(":8080", r))
	}

	// --- Middleware Autentikasi ---
	func authMiddleware(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"Token tidak ditemukan"}`, http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")

			// Validasi token dan pastikan belum di-revoke
			var user User
			var isRevoked bool
			var expiresAt time.Time

			query := `
				SELECT u.id, u.username, u.email, u.role, u.created_at, s.is_revoked, s.expires_at
				FROM sessions s
				JOIN users u ON s.user_id = u.id
				WHERE s.token = $1
				LIMIT 1
			`
			err := db.QueryRow(query, token).Scan(&user.ID, &user.Username, &user.Email, &user.Role, &user.CreatedAt, &isRevoked, &expiresAt)
			if err != nil || isRevoked || time.Now().After(expiresAt) {
				http.Error(w, `{"error":"Sesi tidak valid atau telah berakhir"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userCtxKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	func adminOnlyMiddleware(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := r.Context().Value(userCtxKey).(User)
			if !ok || user.Role != "admin" {
				http.Error(w, `{"error":"Akses khusus admin"}`, http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}

	// --- Handlers ---
	func handleRegister(w http.ResponseWriter, r *http.Request) {
		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Format data tidak valid"}`, http.StatusBadRequest)
			return
		}
		if req.Username == "" || req.Email == "" || req.Password == "" {
			http.Error(w, `{"error":"Semua field wajib diisi"}`, http.StatusBadRequest)
			return
		}

		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, `{"error":"Gagal memproses kata sandi"}`, http.StatusInternalServerError)
			return
		}

		var newID int
		query := `INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, 'user') RETURNING id`
		if err := db.QueryRow(query, req.Username, req.Email, string(hashedPassword)).Scan(&newID); err != nil {
			http.Error(w, `{"error":"Username atau email sudah digunakan"}`, http.StatusConflict)
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{"message": "Registrasi berhasil", "user_id": newID})
	}

	func handleLogin(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Format data tidak valid"}`, http.StatusBadRequest)
			return
		}

		var user User
		var passwordHash string
		queryUser := `SELECT id, username, email, password_hash, role, created_at FROM users WHERE email = $1 OR username = $1 LIMIT 1`
		if err := db.QueryRow(queryUser, req.Identifier).Scan(&user.ID, &user.Username, &user.Email, &passwordHash, &user.Role, &user.CreatedAt); err != nil {
			http.Error(w, `{"error":"Kredensial tidak valid"}`, http.StatusUnauthorized)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
			http.Error(w, `{"error":"Kredensial tidak valid"}`, http.StatusUnauthorized)
			return
		}

		// Aturan 2 sesi aktif: login ke-3 mematikan sesi tertua
		rows, err := db.Query(`SELECT id FROM sessions WHERE user_id = $1 AND is_revoked = FALSE ORDER BY created_at ASC`, user.ID)
		if err == nil {
			defer rows.Close()
			var activeIDs []int
			for rows.Next() {
				var id int
				if rows.Scan(&id) == nil {
					activeIDs = append(activeIDs, id)
				}
			}
			if len(activeIDs) >= 2 {
				_, _ = db.Exec(`UPDATE sessions SET is_revoked = TRUE WHERE id = $1`, activeIDs[0])
			}
		}

		tokenBytes := make([]byte, 32)
		rand.Read(tokenBytes)
		token := hex.EncodeToString(tokenBytes)
		expiresAt := time.Now().Add(24 * time.Hour)

		_, err = db.Exec(`INSERT INTO sessions (user_id, token, user_agent, ip_address, expires_at, is_revoked) VALUES ($1, $2, $3, $4, $5, FALSE)`,
			user.ID, token, r.UserAgent(), r.RemoteAddr, expiresAt)
		if err != nil {
			http.Error(w, `{"error":"Gagal membuat sesi"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"message": "Login berhasil",
			"token":   token,
			"user":    user,
		})
	}

	func handleProfile(w http.ResponseWriter, r *http.Request) {
		user := r.Context().Value(userCtxKey).(User)
		json.NewEncoder(w).Encode(user)
	}

	func handleLogout(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		_, _ = db.Exec(`UPDATE sessions SET is_revoked = TRUE WHERE token = $1`, token)
		json.NewEncoder(w).Encode(map[string]string{"message": "Logout berhasil"})
	}

	func handleAdminGetUsers(w http.ResponseWriter, r *http.Request) {
		// Menampilkan daftar user beserta jumlah sesi aktif
		query := `
			SELECT u.id, u.username, u.email, u.role, u.created_at,
				COUNT(s.id) FILTER (WHERE s.is_revoked = FALSE AND s.expires_at > NOW()) as active_sessions
			FROM users u
			LEFT JOIN sessions s ON u.id = s.user_id
			GROUP BY u.id
			ORDER BY u.id ASC
		`
		rows, err := db.Query(query)
		if err != nil {
			http.Error(w, `{"error":"Gagal mengambil data pengguna"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		users := make([]UserWithSessionCount, 0)
		for rows.Next() {
			var u UserWithSessionCount
			if err := rows.Scan(&u.ID, &u.Username, &u.Email, &u.Role, &u.CreatedAt, &u.ActiveSessions); err == nil {
				users = append(users, u)
			}
		}
		json.NewEncoder(w).Encode(users)
	}

	func handleAdminForceLogout(w http.ResponseWriter, r *http.Request) {
		targetIDStr := chi.URLParam(r, "id")
		targetID, err := strconv.Atoi(targetIDStr)
		if err != nil {
			http.Error(w, `{"error":"ID user tidak valid"}`, http.StatusBadRequest)
			return
		}

		// Nonaktifkan seluruh sesi aktif user target
		_, err = db.Exec(`UPDATE sessions SET is_revoked = TRUE WHERE user_id = $1 AND is_revoked = FALSE`, targetID)
		if err != nil {
			http.Error(w, `{"error":"Gagal melakukan force logout"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"message": fmt.Sprintf("Semua sesi user ID %d telah dimatikan", targetID)})
	}

	func seedAdmin() {
	hash, err := bcrypt.GenerateFromPassword([]byte("adminpassword"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("seed: gagal hash: %v", err)
		return
	}

	res, err := db.Exec(`UPDATE users SET password_hash = $1, role = 'admin' WHERE username = 'superadmin'`, string(hash))
	if err != nil {
		log.Printf("seed: gagal update (tabel users ada?): %v", err)
		return
	}

	if n, _ := res.RowsAffected(); n == 0 {
		_, err = db.Exec(`INSERT INTO users (username, email, password_hash, role) VALUES ('superadmin', 'superadmin@example.com', $1, 'admin')`, string(hash))
		if err != nil {
			log.Printf("seed: gagal insert: %v", err)
			return
		}
	}
	log.Println("seed: superadmin siap (password: adminpassword)")
}