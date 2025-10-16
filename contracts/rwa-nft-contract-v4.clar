;; Title: A.R.I.A. RWA NFT Contract (marketplace-registrable)
;; Author: Nihal Pandey & Gemini (modified)
;; Description: SIP-009 style NFT with an admin-settable marketplace principal.

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

;; Optional stored marketplace principal (set after marketplace deploy)
(define-data-var marketplace-principal (optional principal) none)

;; --- NFT DEFINITION ---
(define-non-fungible-token rwa-nft uint)

;; --- ERRORS ---
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_FOUND u102)
(define-constant ERR_MINT_FAILED u103)
(define-constant ERR_BAD_INPUT u104)

;; --- ADMIN: set marketplace principal (call once after marketplace deploy) ---
;; Only CONTRACT_OWNER (deployer) can call this.
(define-public (set-marketplace (p principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set marketplace-principal (some p))
    (ok true)
  )
)

;; Optional admin helper to clear marketplace (if needed)
(define-public (clear-marketplace)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set marketplace-principal none)
    (ok true)
  )
)

;; Read-only to inspect stored marketplace
(define-read-only (get-marketplace)
  (ok (var-get marketplace-principal))
)

;; --- PUBLIC FUNCTIONS ---

;; mint-rwa: only deployer can mint
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

;; transfer: permit owner OR the registered marketplace principal to call transfer
(define-public (transfer
        (token-id uint)
        (sender principal)
        (recipient principal)
    )
    (begin
        ;; Ensure token exists and get current owner
        (let ((current-owner-opt (nft-get-owner? rwa-nft token-id))
              (mp (var-get marketplace-principal)))
            ;; token must exist
            (asserts! (is-some current-owner-opt) (err ERR_NOT_FOUND))
            (let ((current-owner (unwrap-panic current-owner-opt)))
                ;; Permit if tx-sender is the declared sender (owner) OR equals stored marketplace principal
                (asserts! (or (is-eq tx-sender sender)
                               (and (is-some mp) (is-eq tx-sender (unwrap-panic mp))))
                         (err ERR_UNAUTHORIZED))

                ;; Ensure the declared sender actually is the current owner
                (asserts! (is-eq current-owner sender) (err ERR_UNAUTHORIZED))
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
