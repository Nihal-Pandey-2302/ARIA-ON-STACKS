;; Title: A.R.I.A. RWA NFT Contract v9 - SIMPLIFIED
;; Author: Nihal Pandey & Gemini
;; Description: SIP-009 NFT with marketplace support

(define-constant CONTRACT_OWNER tx-sender)

(define-data-var last-token-id uint u0)
(define-data-var marketplace-principal (optional principal) none)

(define-map token-metadata uint (string-ascii 256))
(define-non-fungible-token rwa-nft uint)

;; ERRORS
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_FOUND u102)

;; Set marketplace (only owner)
(define-public (set-marketplace (p principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) (err ERR_UNAUTHORIZED))
    (var-set marketplace-principal (some p))
    (ok true)
  )
)

(define-read-only (get-marketplace)
  (ok (var-get marketplace-principal))
)

;; Mint NFT (only owner)
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

;; TRANSFER - BULLETPROOF VERSION
(define-public (transfer
    (token-id uint)
    (sender principal)
    (recipient principal)
  )
  (let (
      (current-owner-result (nft-get-owner? rwa-nft token-id))
      (marketplace (var-get marketplace-principal))
    )
    ;; Check token exists
    (if (is-none current-owner-result)
      (err ERR_NOT_FOUND)
      (let ((current-owner (unwrap-panic current-owner-result)))
        ;; Check sender is actual owner
        (if (not (is-eq current-owner sender))
          (err ERR_UNAUTHORIZED)
          ;; Check authorization: owner calling directly OR marketplace calling
          (if (is-eq tx-sender sender)
            ;; Owner is calling directly - allowed
            (nft-transfer? rwa-nft token-id sender recipient)
            ;; Someone else is calling - check if it's the marketplace
            (if (is-some marketplace)
              (if (is-eq contract-caller (unwrap-panic marketplace))
                ;; Marketplace is calling - allowed
                (nft-transfer? rwa-nft token-id sender recipient)
                ;; Not marketplace - denied
                (err ERR_UNAUTHORIZED)
              )
              ;; No marketplace set - denied
              (err ERR_UNAUTHORIZED)
            )
          )
        )
      )
    )
  )
)

;; Read-only functions
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (ok (map-get? token-metadata token-id))
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? rwa-nft token-id))
)