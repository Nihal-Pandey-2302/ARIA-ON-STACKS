;; --------------------------------------------------
;; Title: A.R.I.A. Marketplace Contract (v2)
;; Author: Nihal Pandey 
;; Description:
;;   Secure NFT marketplace allowing users to list,
;;   unlist, and purchase Real-World Asset NFTs (RWA)
;;   using STX. Fixes ownership + transfer issues
;;   from v1.
;; --------------------------------------------------

(define-trait sip-009-trait (
    (transfer (uint principal principal) (response bool uint))
    (get-owner (uint) (response (optional principal) uint))
))

;; --------------------------------------------------
;; CONSTANTS
;; --------------------------------------------------
(define-constant RWA_NFT_CONTRACT .rwa-nft-contract)
(define-constant STAKING_CONTRACT .staking-contract)
(define-constant PLATFORM_FEE_PERCENT u5) ;; 5%

;; --------------------------------------------------
;; DATA STRUCTURES
;; --------------------------------------------------
(define-map listings
    uint
    {
        price: uint,
        seller: principal
    }
)

;; --------------------------------------------------
;; ERRORS
;; --------------------------------------------------
(define-constant ERR_UNAUTHORIZED u201)
(define-constant ERR_NOT_LISTED u202)
(define-constant ERR_ALREADY_LISTED u203)
(define-constant ERR_NFT_TRANSFER_FAILED u204)
(define-constant ERR_STX_TRANSFER_FAILED u205)

;; --------------------------------------------------
;; PUBLIC FUNCTIONS
;; --------------------------------------------------

;; --------------------------------------------------
;; List an NFT for sale
;; --------------------------------------------------
(define-public (list-asset (token-id uint) (price uint))
  (begin
    (asserts! (> price u0) (err ERR_STX_TRANSFER_FAILED))
    (asserts! (is-none (map-get? listings token-id)) (err ERR_ALREADY_LISTED))

    ;; ✅ FIXED: transfer NFT to marketplace contract
    (try! (contract-call? RWA_NFT_CONTRACT transfer token-id tx-sender (as-contract tx-sender)))

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

;; --------------------------------------------------
;; Unlist a token (return NFT to seller)
;; --------------------------------------------------
(define-public (unlist-asset (token-id uint))
  (let ((listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED))))
    (begin
      (asserts! (is-eq tx-sender (get seller listing)) (err ERR_UNAUTHORIZED))

      ;; ✅ Transfer NFT back from contract to seller
      (try! (as-contract (contract-call? RWA_NFT_CONTRACT transfer token-id (as-contract tx-sender) (get seller listing))))

      (map-delete listings token-id)

      (print {
        action: "unlist-asset",
        token-id: token-id
      })
      (ok true)
    )
  )
)

;; --------------------------------------------------
;; Purchase a listed NFT
;; --------------------------------------------------
(define-public (purchase-asset (token-id uint))
  (let (
        (listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED)))
        (price (get price listing))
        (seller (get seller listing))
        (buyer tx-sender)
       )
    (let (
          (fee (/ (* price PLATFORM_FEE_PERCENT) u100))
          (seller-amount (- price fee))
         )
      (begin
        ;; Transfer STX from buyer → seller and platform
        (try! (stx-transfer? seller-amount buyer seller))
        (try! (stx-transfer? fee buyer STAKING_CONTRACT))
        (try! (contract-call? STAKING_CONTRACT deposit-rewards))

        ;; ✅ Transfer NFT from marketplace → buyer
        (try! (as-contract (contract-call? RWA_NFT_CONTRACT transfer token-id (as-contract tx-sender) buyer)))

        (map-delete listings token-id)

        (print {
          action: "purchase-asset",
          token-id: token-id,
          buyer: buyer,
          price: price
        })
        (ok true)
      )
    )
  )
)

;; --------------------------------------------------
;; READ-ONLY FUNCTIONS
;; --------------------------------------------------
(define-read-only (get-listing (token-id uint))
  (map-get? listings token-id)
)
