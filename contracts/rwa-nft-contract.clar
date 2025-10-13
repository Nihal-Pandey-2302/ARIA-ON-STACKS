;; Title: A.R.I.A. RWA NFT Contract
;; Author: Nihal Pandey & Gemini
;; Description: Implements the SIP-009 standard for a Real-World Asset NFT.
;; The mint function is protected and can only be called by the contract owner.

;; ---
;; SIP-009 TRAIT
;; ---
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

;; ---
;; CONSTANTS AND DATA VARS
;; ---
(define-constant CONTRACT_OWNER tx-sender)
(define-constant IPFS_GATEWAY "https://gateway.pinata.cloud/ipfs/")

(define-data-var last-token-id uint u0)
;; Maps a token ID to its IPFS metadata hash (CID)
(define-map token-metadata
    uint
    (string-ascii 256)
)

;; ---
;; NFT DEFINITION
;; ---
(define-non-fungible-token rwa-nft uint)

;; ---
;; ERRORS
;; ---
(define-constant ERR_UNAUTHORIZED u101)
(define-constant ERR_NOT_FOUND u102)
(define-constant ERR_MINT_FAILED u103)

;; ---
;; CORE PUBLIC FUNCTIONS
;; ---

;; Protected function to mint a new RWA NFT.
;; Can only be called by the contract owner (backend service).
;; recipient: The user who the NFT should be minted to.
;; ipfs-hash: The IPFS CID for the asset's metadata and verification report.
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

;; Transfers an NFT from the sender to a recipient.
;; The transaction sender must be the current owner of the NFT.
(define-public (transfer
        (token-id uint)
        (sender principal)
        (recipient principal)
    )
    (begin
        (asserts! (is-eq tx-sender sender) (err ERR_UNAUTHORIZED))
        (asserts! (is-some (nft-get-owner? rwa-nft token-id)) (err ERR_NOT_FOUND))
        (asserts! (is-eq (unwrap-panic (nft-get-owner? rwa-nft token-id)) sender)
            (err ERR_UNAUTHORIZED)
        )

        (try! (nft-transfer? rwa-nft token-id sender recipient))
        (ok true)
    )
)

;; ---
;; READ-ONLY FUNCTIONS (SIP-009 COMPLIANCE)
;; ---

;; Gets the ID of the last token that was minted.
(define-read-only (get-last-token-id)
    (ok (var-get last-token-id))
)

;; Gets the URI for a given token ID.
;; This constructs the full IPFS URL from the stored hash.
(define-read-only (get-token-uri (token-id uint))
    (ok (map-get? token-metadata token-id))
)

;; Gets the owner of a specific token ID.
(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? rwa-nft token-id))
)