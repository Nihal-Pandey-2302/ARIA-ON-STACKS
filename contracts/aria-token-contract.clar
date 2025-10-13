;; Title: ARIA Token Contract
;; Author: Nihal Pandey & Gemini
;; Description: Implements the SIP-010 standard for a fungible token.

;; ---
;; SIP-010 TRAIT
;; ---
(define-trait sip-010-trait
  ((transfer (principal uint principal (optional (buff 34))) (response bool uint))
   (get-name () (response (string-ascii 32) uint))
   (get-symbol () (response (string-ascii 32) uint))
   (get-decimals () (response uint uint))
   (get-balance (principal) (response uint uint))
   (get-total-supply () (response uint uint))
   (get-token-uri () (response (optional (string-utf8 256)) uint))))

;; ---
;; CONSTANTS AND DATA VARS
;; ---
(define-constant CONTRACT_OWNER tx-sender)
(define-constant TOKEN_NAME "Aria")
(define-constant TOKEN_SYMBOL "ARIA")
(define-constant TOKEN_DECIMALS u6)
(define-constant TOTAL_SUPPLY u100000000000000) ;; 100,000,000 tokens with 6 decimals

(define-fungible-token aria TOTAL_SUPPLY)

(define-data-var token-uri (optional (string-utf8 256)) (some u"https://aria.rwa/token-metadata.json"))

;; ---
;; ERRORS
;; ---
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_OWNER u102)

;; ---
;; PUBLIC FUNCTIONS
;; ---

;; Transfer tokens to a recipient
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR_UNAUTHORIZED))
    (try! (ft-transfer? aria amount sender recipient))
    (ok true)
  )
)

;; ---
;; READ-ONLY FUNCTIONS
;; ---

(define-read-only (get-name)
  (ok TOKEN_NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN_SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN_DECIMALS)
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance aria owner))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply aria))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; ---
;; MINTING (on contract deployment)
;; ---
(begin
  (ft-mint? aria TOTAL_SUPPLY CONTRACT_OWNER)
)