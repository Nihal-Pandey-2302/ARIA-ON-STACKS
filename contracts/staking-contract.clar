;; Title: A.R.I.A. Staking Contract
;; Author: Nihal Pandey & Gemini
;; Description: Manages ARIA token staking and reward distribution in STX.

;; ---
;; TRAITS
;; ---
(define-trait sip-010-trait (
    (transfer
        (uint principal principal (optional (buff 34)))
        (response bool uint)
    )
))

;; ---
;; CONSTANTS
;; ---
(define-constant ARIA_TOKEN_CONTRACT .aria-token-contract)
(define-constant ERR_UNAUTHORIZED u301)
(define-constant ERR_INSUFFICIENT_STAKE u302)
(define-constant ERR_NO_REWARDS_TO_CLAIM u303)
(define-constant ERR_NOTHING_TO_STAKE u304)

;; ---
;; DATA STORAGE
;; ---
(define-map stakers
    principal
    uint
)
(define-data-var total-aria-staked uint u0)

;; ---
;; INTERNAL FUNCTIONS
;; ---
(define-read-only (get-claimable-rewards-for (user principal))
    (let (
            (user-stake (get-staked-balance-for user))
            (total-staked (var-get total-aria-staked))
            (contract-stx-balance (stx-get-balance (as-contract tx-sender)))
        )
        (if (> total-staked u0)
            (/ (* user-stake contract-stx-balance) total-staked)
            u0
        )
    )
)

;; ---
;; PUBLIC FUNCTIONS
;; ---
(define-public (deposit-rewards)
    (begin
        (asserts! true (err u0))
        (ok true)
    )
)

(define-public (stake (amount uint))
    (begin
        (asserts! (> amount u0) (err ERR_NOTHING_TO_STAKE))
        (try! (contract-call? ARIA_TOKEN_CONTRACT transfer amount tx-sender
            (as-contract tx-sender) none
        ))
        (let ((current-stake (get-staked-balance-for tx-sender)))
            (map-set stakers tx-sender (+ current-stake amount))
            (var-set total-aria-staked (+ (var-get total-aria-staked) amount))
            (ok true)
        )
    )
)

(define-public (unstake (amount uint))
    (let ((current-stake (get-staked-balance-for tx-sender)))
        (asserts! (>= current-stake amount) (err ERR_INSUFFICIENT_STAKE))
        (try! (as-contract (contract-call? ARIA_TOKEN_CONTRACT transfer amount
            (as-contract tx-sender) tx-sender none
        )))
        (map-set stakers tx-sender (- current-stake amount))
        (var-set total-aria-staked (- (var-get total-aria-staked) amount))
        (ok true)
    )
)

(define-public (claim-rewards)
    (let ((claimable-amount (get-claimable-rewards-for tx-sender)))
        (asserts! (> claimable-amount u0) (err ERR_NO_REWARDS_TO_CLAIM))
        (try! (as-contract (stx-transfer? claimable-amount (as-contract tx-sender) tx-sender)))
        (ok true)
    )
)

;; ---
;; READ-ONLY FUNCTIONS
;; ---
(define-read-only (get-staked-balance-for (user principal))
    (default-to u0 (map-get? stakers user))
)

(define-read-only (get-total-aria-staked)
    (var-get total-aria-staked)
)

(define-read-only (get-claimable-rewards)
    (get-claimable-rewards-for tx-sender)
)