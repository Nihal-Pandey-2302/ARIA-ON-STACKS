;; Title: A.R.I.A. Unified RWA NFT + Marketplace Contract
;; Author: Nihal Pandey & Gemini
;; Description: All-in-one NFT minting and marketplace

;; ===========================
;; NFT SECTION
;; ===========================

(define-constant CONTRACT_OWNER tx-sender)
(define-data-var last-token-id uint u0)
(define-map token-metadata uint (string-ascii 256))
(define-non-fungible-token rwa-nft uint)

;; NFT Errors
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_FOUND u102)

;; ===========================
;; MARKETPLACE SECTION
;; ===========================

(define-map listings
  uint
  {
    price: uint,
    seller: principal
  }
)

;; Marketplace Errors
(define-constant ERR_INVALID_PRICE u206)
(define-constant ERR_ALREADY_LISTED u203)
(define-constant ERR_NOT_LISTED u202)
(define-constant ERR_NOT_OWNER u207)

;; ===========================
;; NFT FUNCTIONS
;; ===========================

;; Mint NFT (only owner can mint)
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

;; Transfer NFT - SIMPLE because it's all in one contract
(define-public (transfer
    (token-id uint)
    (sender principal)
    (recipient principal)
  )
  (begin
    ;; Get current owner
    (let ((owner (unwrap! (nft-get-owner? rwa-nft token-id) (err ERR_NOT_FOUND))))
      
      ;; Sender must be the actual owner
      (asserts! (is-eq owner sender) (err ERR_UNAUTHORIZED))
      
      ;; Only owner can transfer (listings/purchases use internal functions)
      (asserts! (is-eq tx-sender sender) (err ERR_UNAUTHORIZED))
      
      ;; Do the transfer
      (nft-transfer? rwa-nft token-id sender recipient)
    )
  )
)

;; ===========================
;; MARKETPLACE FUNCTIONS
;; ===========================

;; List NFT for sale
(define-public (list-asset (token-id uint) (price uint))
  (begin
    ;; Validate price
    (asserts! (> price u0) (err ERR_INVALID_PRICE))
    
    ;; Check token exists and caller owns it
    (let ((owner (unwrap! (nft-get-owner? rwa-nft token-id) (err ERR_NOT_FOUND))))
      (asserts! (is-eq tx-sender owner) (err ERR_NOT_OWNER))
    )
    
    ;; Check not already listed
    (asserts! (is-none (map-get? listings token-id)) (err ERR_ALREADY_LISTED))
    
    ;; Create listing (NFT stays with owner until purchase)
    (map-set listings token-id {
      price: price,
      seller: tx-sender
    })
    
    (print {
      action: "list-asset",
      token-id: token-id,
      price: price,
      seller: tx-sender
    })
    (ok true)
  )
)

;; Unlist NFT
(define-public (unlist-asset (token-id uint))
  (let ((listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED))))
    (begin
      ;; Only seller can unlist
      (asserts! (is-eq tx-sender (get seller listing)) (err ERR_UNAUTHORIZED))
      
      ;; Remove listing
      (map-delete listings token-id)
      
      (print {
        action: "unlist-asset",
        token-id: token-id
      })
      (ok true)
    )
  )
)

;; Purchase NFT
(define-public (purchase-asset (token-id uint))
  (let (
      (listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED)))
      (buyer tx-sender)
      (price (get price listing))
      (seller (get seller listing))
    )
    (begin
      ;; Prevent self-purchase
      (asserts! (not (is-eq buyer seller)) (err ERR_UNAUTHORIZED))
      
      ;; Verify seller still owns the NFT
      (let ((current-owner (unwrap! (nft-get-owner? rwa-nft token-id) (err ERR_NOT_FOUND))))
        (asserts! (is-eq current-owner seller) (err ERR_UNAUTHORIZED))
      )
      
      ;; Transfer STX from buyer to seller
      (try! (stx-transfer? price buyer seller))
      
      ;; Transfer NFT from seller to buyer (internal call, no auth issues!)
      (try! (nft-transfer? rwa-nft token-id seller buyer))
      
      ;; Remove listing
      (map-delete listings token-id)
      
      (print {
        action: "purchase-asset",
        token-id: token-id,
        buyer: buyer,
        seller: seller,
        price: price
      })
      (ok true)
    )
  )
)

;; ===========================
;; READ-ONLY FUNCTIONS
;; ===========================

;; NFT read-only
(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (ok (map-get? token-metadata token-id))
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? rwa-nft token-id))
)

;; Marketplace read-only
(define-read-only (get-listing (token-id uint))
  (map-get? listings token-id)
)

(define-read-only (is-listed (token-id uint))
  (is-some (map-get? listings token-id))
)