;; Title: ARIA Token Contract v2
;; Author: Nihal Pandey & Gemini
;; Description: SIP-010 fungible token, minted to deployer on deployment

(define-trait sip-010-trait
  ((transfer (principal uint principal (optional (buff 34))) (response bool uint))
   (get-name () (response (string-ascii 32) uint))
   (get-symbol () (response (string-ascii 32) uint))
   (get-decimals () (response uint uint))
   (get-balance (principal) (response uint uint))
   (get-total-supply () (response uint uint))
   (get-token-uri () (response (optional (string-utf8 256)) uint))))

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant TOKEN_NAME "Aria")
(define-constant TOKEN_SYMBOL "ARIA")
(define-constant TOKEN_DECIMALS u6)
(define-constant TOTAL_SUPPLY u100000000000000) ;; 100M with 6 decimals

;; Fungible token
(define-fungible-token aria TOTAL_SUPPLY)

;; Token metadata URI
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://aria.rwa/token-metadata.json"))

;; Errors
(define-constant ERR_UNAUTHORIZED u101)

;; Public transfer function
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err ERR_UNAUTHORIZED))
    (try! (ft-transfer? aria amount sender recipient))
    (ok true)
  )
)

;; Read-only getters
(define-read-only (get-name) (ok TOKEN_NAME))
(define-read-only (get-symbol) (ok TOKEN_SYMBOL))
(define-read-only (get-decimals) (ok TOKEN_DECIMALS))
(define-read-only (get-balance (owner principal)) (ok (ft-get-balance aria owner)))
(define-read-only (get-total-supply) (ok (ft-get-supply aria)))
(define-read-only (get-token-uri) (ok (var-get token-uri)))

;; Mint all tokens to deployer on deployment
(begin
  (ft-mint? aria TOTAL_SUPPLY CONTRACT_OWNER)
)
