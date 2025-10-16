;; Title: A.R.I.A. Marketplace Contract v3
;; Author: Nihal Pandey & Gemini
;; Description: Allows users to list, unlist, and purchase RWA NFTs using STX.

(define-trait sip-009-trait (
    (transfer
        (uint principal principal)
        (response bool uint)
    )
    (get-owner
        (uint)
        (response (optional principal) uint)
    )
))

;; ---
;; CONSTANTS
;; ---
(define-constant RWA_NFT_CONTRACT .rwa-nft-contract-v5)
(define-constant STAKING_CONTRACT .staking-contract)
(define-constant PLATFORM_FEE_PERCENT u5)

;; ---
;; DATA MAPS
;; ---
(define-map listings
    uint
    {
        price: uint,
        seller: principal
    }
)

;; ---
;; ERRORS
;; ---
(define-constant ERR_UNAUTHORIZED u201)
(define-constant ERR_NOT_LISTED u202)
(define-constant ERR_ALREADY_LISTED u203)
(define-constant ERR_NFT_TRANSFER_FAILED u204)
(define-constant ERR_STX_TRANSFER_FAILED u205)
(define-constant ERR_INVALID_PRICE u206)

;; ---
;; PUBLIC FUNCTIONS
;; ---
(define-public (list-asset (token-id uint) (price uint))
    (begin
        ;; Validate price
        (asserts! (> price u0) (err ERR_INVALID_PRICE))

        ;; Check if already listed
        (asserts! (is-none (map-get? listings token-id)) (err ERR_ALREADY_LISTED))

        ;; Transfer NFT from seller to this contract
        (try! (contract-call? RWA_NFT_CONTRACT transfer token-id tx-sender (as-contract tx-sender)))

        ;; Create listing
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

(define-public (unlist-asset (token-id uint))
    (let ((listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED))))
        (begin
            ;; Only seller can unlist
            (asserts! (is-eq tx-sender (get seller listing)) (err ERR_UNAUTHORIZED))

            ;; Transfer NFT back to seller
            (try! (contract-call? RWA_NFT_CONTRACT transfer token-id (as-contract tx-sender) (get seller listing)))

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

(define-public (purchase-asset (token-id uint))
    (let ((listing (unwrap! (map-get? listings token-id) (err ERR_NOT_LISTED)))
          (buyer tx-sender))
        (let ((price (get price listing))
              (seller (get seller listing))
              (fee (/ (* price PLATFORM_FEE_PERCENT) u100))
              (seller-amount (- price fee)))
            (begin
                ;; Prevent self-purchase
                (asserts! (not (is-eq buyer seller)) (err ERR_UNAUTHORIZED))

                ;; Transfer STX to seller
                (try! (stx-transfer? seller-amount buyer seller))

                ;; Transfer fee to staking contract
                (try! (stx-transfer? fee buyer STAKING_CONTRACT))

                ;; Deposit rewards via staking contract
                (try! (contract-call? STAKING_CONTRACT deposit-rewards))

                ;; Transfer NFT to buyer
                (try! (contract-call? RWA_NFT_CONTRACT transfer token-id (as-contract tx-sender) buyer))

                ;; Remove listing
                (map-delete listings token-id)

                (print {
                    action: "purchase-asset",
                    token-id: token-id,
                    buyer: buyer,
                    seller: seller,
                    price: price,
                    fee: fee
                })
                (ok true)
            )
        )
    )
)

;; ---
;; READ-ONLY FUNCTIONS
;; ---
(define-read-only (get-listing (token-id uint))
    (map-get? listings token-id)
)

(define-read-only (is-listed (token-id uint))
    (is-some (map-get? listings token-id))
)