// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustRoot
 * @notice Stores Merkle roots of TrustAdd agent trust scores.
 *         Anyone can verify a score by checking a proof against a published root.
 * @dev Owner publishes a new root after each daily score recalculation.
 *      No on-chain proof verification — consumers verify off-chain or in their own contracts
 *      using OpenZeppelin MerkleProof.sol against `roots[root].timestamp`.
 */
contract TrustRoot {
    address public owner;

    struct RootEntry {
        uint64 timestamp;     // block.timestamp when published
        uint32 agentCount;    // number of agents in the tree
        uint16 methodology;   // methodology version (currently 1)
    }

    mapping(bytes32 => RootEntry) public roots;
    bytes32 public latestRoot;
    uint256 public rootCount;

    event RootPublished(
        bytes32 indexed root,
        uint256 agentCount,
        uint16 methodology,
        uint256 timestamp
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "TrustRoot: caller is not the owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Publish a new Merkle root of agent trust scores.
     * @param root The Merkle root hash
     * @param agentCount Number of agents included in the tree
     * @param methodology Scoring methodology version
     */
    function publishRoot(
        bytes32 root,
        uint32 agentCount,
        uint16 methodology
    ) external onlyOwner {
        require(root != bytes32(0), "TrustRoot: empty root");
        require(roots[root].timestamp == 0, "TrustRoot: root already published");

        roots[root] = RootEntry({
            timestamp: uint64(block.timestamp),
            agentCount: agentCount,
            methodology: methodology
        });
        latestRoot = root;
        rootCount++;

        emit RootPublished(root, agentCount, methodology, block.timestamp);
    }

    /**
     * @notice Transfer ownership to a new address.
     * @param newOwner The address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TrustRoot: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
