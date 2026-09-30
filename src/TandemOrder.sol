// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./libraries/ECDSA.sol";

/// @title TandemOrder
/// @notice EIP-712 order hashing, signature verification, and replay protection
abstract contract TandemOrder {
    using ECDSA for bytes32;

    // ============ Structs ============

    /// @notice Parameters signed by the user for an atomic spread entry
    struct SpreadOrder {
        address owner;          // User EOA who authorizes the trade
        address account;        // Trading account / vault (or router if direct)
        uint256 nonce;          // Replay protection nonce
        uint256 expiry;         // Expiration timestamp
        address kuruMarket;     // Kuru OrderBook address (spot leg)
        address quoteToken;     // Quote token for spot buy (USDC / AUSD)
        uint256 perpId;         // Perpl market ID (perp leg)
        uint96  quantity;       // Base asset quantity (MON, 18 decimals)
        uint256 perpLots;       // Number of lots to short on Perpl (0 = auto 1:1)
        uint256 maxSpotSpend;   // Maximum quote tokens to spend on spot
        uint256 minPerpPrice;   // Minimum acceptable perp price (scaled)
        uint256 collateral;     // Collateral to deposit on Perpl (AUSD)
        int256  minSpread;      // Minimum net adjusted entry spread (1e6)
        uint256 maxFee;         // Maximum allowed fee (1e6)
    }

    /// @notice Parameters signed by the user for an atomic spread close / exit
    struct CloseOrder {
        address owner;          // User EOA
        address account;        // Trading account / vault
        uint256 nonce;          // Replay protection nonce
        uint256 expiry;         // Expiration timestamp
        address kuruMarket;     // Kuru OrderBook address
        address quoteToken;     // Quote token received from spot sale (USDC / AUSD)
        uint256 perpId;         // Perpl market ID
        uint96  quantity;       // Base asset quantity to sell / close
        uint256 perpLots;       // Perp lots to close (0 = auto 1:1)
        uint256 minSpotProceeds;// Minimum quote tokens to receive from spot sale
        uint256 maxPerpClosePrice; // Maximum price to buy back short
        int256  minExitSpread;  // Minimum acceptable exit spread
    }

    // ============ Constants ============

    bytes32 public constant SPREAD_ORDER_TYPEHASH = keccak256(
        "SpreadOrder(address owner,address account,uint256 nonce,uint256 expiry,address kuruMarket,address quoteToken,uint256 perpId,uint96 quantity,uint256 perpLots,uint256 maxSpotSpend,uint256 minPerpPrice,uint256 collateral,int256 minSpread,uint256 maxFee)"
    );

    bytes32 public constant CLOSE_ORDER_TYPEHASH = keccak256(
        "CloseOrder(address owner,address account,uint256 nonce,uint256 expiry,address kuruMarket,address quoteToken,uint256 perpId,uint96 quantity,uint256 perpLots,uint256 minSpotProceeds,uint256 maxPerpClosePrice,int256 minExitSpread)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;

    // ============ State ============

    mapping(bytes32 => bool) public isOrderExecuted;
    mapping(address => mapping(uint256 => bool)) public isNonceCancelled;

    // ============ Events ============

    event OrderExecuted(bytes32 indexed orderHash, address indexed owner);
    event OrderCancelled(bytes32 indexed orderHash, address indexed owner);
    event NonceCancelled(address indexed owner, uint256 indexed nonce);

    // ============ Errors ============

    error OrderExpired(uint256 expiry, uint256 currentTimestamp);
    error OrderAlreadyExecuted(bytes32 orderHash);
    error NonceAlreadyUsedOrCancelled(address owner, uint256 nonce);
    error InvalidOrderSigner(address recovered, address expected);

    // ============ Constructor ============

    constructor() {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("TandemSpreadOrders")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ Hashing Functions ============

    function hashSpreadOrder(SpreadOrder memory order) public view returns (bytes32) {
        bytes memory part1 = abi.encode(
            SPREAD_ORDER_TYPEHASH,
            order.owner,
            order.account,
            order.nonce,
            order.expiry,
            order.kuruMarket,
            order.quoteToken,
            order.perpId
        );
        bytes memory part2 = abi.encode(
            order.quantity,
            order.perpLots,
            order.maxSpotSpend,
            order.minPerpPrice,
            order.collateral,
            order.minSpread,
            order.maxFee
        );
        bytes32 structHash = keccak256(bytes.concat(part1, part2));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    function hashCloseOrder(CloseOrder memory order) public view returns (bytes32) {
        bytes memory part1 = abi.encode(
            CLOSE_ORDER_TYPEHASH,
            order.owner,
            order.account,
            order.nonce,
            order.expiry,
            order.kuruMarket,
            order.quoteToken
        );
        bytes memory part2 = abi.encode(
            order.perpId,
            order.quantity,
            order.perpLots,
            order.minSpotProceeds,
            order.maxPerpClosePrice,
            order.minExitSpread
        );
        bytes32 structHash = keccak256(bytes.concat(part1, part2));
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    // ============ Validation ============

    function _verifySpreadOrder(SpreadOrder memory order, bytes memory signature) internal returns (bytes32 orderHash) {
        if (block.timestamp > order.expiry) {
            revert OrderExpired(order.expiry, block.timestamp);
        }
        if (isNonceCancelled[order.owner][order.nonce]) {
            revert NonceAlreadyUsedOrCancelled(order.owner, order.nonce);
        }

        orderHash = hashSpreadOrder(order);
        if (isOrderExecuted[orderHash]) {
            revert OrderAlreadyExecuted(orderHash);
        }

        address signer = orderHash.recover(signature);
        if (signer != order.owner) {
            revert InvalidOrderSigner(signer, order.owner);
        }

        // Mark executed & nonce used
        isOrderExecuted[orderHash] = true;
        isNonceCancelled[order.owner][order.nonce] = true;
        emit OrderExecuted(orderHash, order.owner);
    }

    function _verifyCloseOrder(CloseOrder memory order, bytes memory signature) internal returns (bytes32 orderHash) {
        if (block.timestamp > order.expiry) {
            revert OrderExpired(order.expiry, block.timestamp);
        }
        if (isNonceCancelled[order.owner][order.nonce]) {
            revert NonceAlreadyUsedOrCancelled(order.owner, order.nonce);
        }

        orderHash = hashCloseOrder(order);
        if (isOrderExecuted[orderHash]) {
            revert OrderAlreadyExecuted(orderHash);
        }

        address signer = orderHash.recover(signature);
        if (signer != order.owner) {
            revert InvalidOrderSigner(signer, order.owner);
        }

        isOrderExecuted[orderHash] = true;
        isNonceCancelled[order.owner][order.nonce] = true;
        emit OrderExecuted(orderHash, order.owner);
    }

    // ============ Cancellation ============

    function cancelNonce(uint256 nonce) external {
        isNonceCancelled[msg.sender][nonce] = true;
        emit NonceCancelled(msg.sender, nonce);
    }
}
