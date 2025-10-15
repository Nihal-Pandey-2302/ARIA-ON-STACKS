;; File: mint-aria-to-deployer.clar

;; Replace with your deployed ARIA token contract
(define-constant ARIA_TOKEN_CONTRACT ST16W5DG0N8VP85W6DK1ZB4ME3BK3WN2750H78FNX.aria-token-v2)

;; Replace with your deployer address
(define-constant DEPLOYER ST16W5DG0N8VP85W6DK1ZB4ME3BK3WN2750H78FNX)

;; Mint TOTAL_SUPPLY (or any amount you want to test)
(begin
  (ft-mint? aria u100000000000000 DEPLOYER)
)
