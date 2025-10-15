;; Title: ARIA Staking Contract v3
;; Author: Nihal Pandey 
;; Description: Stake ARIA tokens, earn STX rewards

;; Constants
(define-constant ARIA_TOKEN_CONTRACT 'ST16W5DG0N8VP85W6DK1ZB4ME3BK3WN2750H78FNX.aria-token-v2)
(define-constant ERR_INSUFFICIENT_STAKE u302)
(define-constant ERR_NO_REWARDS u303)
(define-constant ERR_NOTHING_TO_STAKE u304)

;; Data storage
(define-map stakers
    principal
    uint
)
(define-data-var total-aria-staked uint u0)

;; Read-only: get staked balance
(define-read-only (get-staked-balance-for (user principal))
  (default-to u0 (map-get? stakers user))
)

;; Read-only: claimable rewards for user
(define-read-only (get-claimable-rewards-for (user principal))
  (let ((user-stake (get-staked-balance-for user))
        (total-staked (var-get total-aria-staked))
        (contract-stx-balance (stx-get-balance (as-contract tx-sender))))
    (if (> total-staked u0)
        (/ (* user-stake contract-stx-balance) total-staked)
        u0
    )
  )
)

;; Public: stake ARIA
(define-public (stake (amount uint))
  (begin
    (asserts! (> amount u0) (err ERR_NOTHING_TO_STAKE))
    ;; Transfer ARIA from user to this contract
    (try! (contract-call? ARIA_TOKEN_CONTRACT transfer amount tx-sender (as-contract tx-sender) none))
    ;; Update staked balances
    (let ((current-stake (get-staked-balance-for tx-sender)))
      (map-set stakers tx-sender (+ current-stake amount))
      (var-set total-aria-staked (+ (var-get total-aria-staked) amount))
      (ok true)
    )
  )
)

;; Public: unstake ARIA
(define-public (unstake (amount uint))
  (let ((current-stake (get-staked-balance-for tx-sender)))
    (asserts! (>= current-stake amount) (err ERR_INSUFFICIENT_STAKE))
    ;; Transfer ARIA back to user
    (try! (contract-call? ARIA_TOKEN_CONTRACT transfer amount (as-contract tx-sender) tx-sender none))
    (map-set stakers tx-sender (- current-stake amount))
    (var-set total-aria-staked (- (var-get total-aria-staked) amount))
    (ok true)
  )
)

;; Public: claim rewards (STX)
(define-public (claim-rewards)
  (let ((claimable (get-claimable-rewards-for tx-sender)))
    (asserts! (> claimable u0) (err ERR_NO_REWARDS))
    (try! (stx-transfer? claimable (as-contract tx-sender) tx-sender))
    (ok true)
  )
)

;; Read-only: total ARIA staked
(define-read-only (get-total-aria-staked)
  (var-get total-aria-staked)
)

;; Read-only: claimable rewards for tx-sender
(define-read-only (get-claimable-rewards)
  (get-claimable-rewards-for tx-sender)
)
