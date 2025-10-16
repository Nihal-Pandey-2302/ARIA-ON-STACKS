;; Title: A.R.I.A. RWA NFT Contract v5 (Fixed Transfer)
;; Author: Nihal Pandey & Gemini (modified)
;; Description: SIP-009 style NFT with marketplace integration

(define-trait sip-009-trait (
    (transfer
        (uint principal principal)
        (response bool uint)
    )
    (get-last-token-id
        ()
        (response uint uint)
    )
    (get-token-uri
        (uint)
        (response (optional (string-utf8 256)) uint)
    )
    (get-owner
        (uint)
        (response (optional principal) uint)
    )
))

;; --- CONSTANTS & DATA VARS ---
(define-constant CONTRACT_OWNER tx-sender)
(define-constant IPFS_GATEWAY "https://gateway.pinata.cloud/ipfs/")

(define-data-var last-token-id uint u0)
(define-map token-metadata
    uint
    (string-ascii 256)
)

;; Optional stored marketplace principal
(define-data-var marketplace-principal (optional principal) none)

;; --- NFT DEFINITION ---
(define-non-fungible-token rwa-nft uint)

;; --- ERRORS ---
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_FOUND u102)
(define-constant ERR_MINT_FAILED u103)
(define-constant ERR_BAD_INPUT u104)

;; --- ADMIN: set marketplace principal ---
(define-public (set-marketplace (p principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set marketplace-principal (some p))
    (ok true)
  )
)

(define-public (clear-marketplace)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set marketplace-principal none)
    (ok true)
  )
)

(define-read-only (get-marketplace)
  (ok (var-get marketplace-principal))
)

;; --- PUBLIC FUNCTIONS ---

(define-public (mint-rwa
        (recipient principal)
        (ipfs-hash (string-ascii 256))
    )
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
        (let ((next-token-id (+ (var-get last-token-id) u1)))
            (try! (nft-mint? rwa-nft next-token-id recipient))
            (map-set token-metadata next-token-id ipfs-hash)
            (var-set last-token-id next-token-id)
            (ok next-token-id)
        )
    )
)

;; FIXED: transfer function that properly handles marketplace calls
(define-public (transfer
        (token-id uint)
        (sender principal)
        (recipient principal)
    )
    (begin
        (let ((current-owner-opt (nft-get-owner? rwa-nft token-id))
              (mp (var-get marketplace-principal)))
            
            ;; Token must exist
            (asserts! (is-some current-owner-opt) (err ERR_NOT_FOUND))
            
            (let ((current-owner (unwrap-panic current-owner-opt)))
                ;; Ensure declared sender is the actual owner
                (asserts! (is-eq current-owner sender) (err ERR_UNAUTHORIZED))
                
                ;; Allow transfer if:
                ;; 1. tx-sender is the owner (direct transfer)
                ;; 2. OR contract-caller is the registered marketplace (marketplace listing/sale)
                (asserts! 
                    (or 
                        (is-eq tx-sender sender)
                        (and (is-some mp) (is-eq contract-caller (unwrap-panic mp)))
                    )
                    (err ERR_UNAUTHORIZED)
                )
            )
        )

        (try! (nft-transfer? rwa-nft token-id sender recipient))
        (ok true)
    )
)

;; --- READ-ONLY FUNCTIONS ---
(define-read-only (get-last-token-id)
    (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
    (ok (map-get? token-metadata token-id))
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? rwa-nft token-id))
)