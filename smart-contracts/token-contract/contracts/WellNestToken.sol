// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Capped} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

// ERC20Capped inherits from ERC20
contract WellNestToken is ERC20Capped, ERC20Burnable {
    address payable private s_owner;
    uint256 private blockReward;
    
    // Map user ID (from MongoDB) to claimable rewards
    mapping(string => uint256) public claimableRewards;
    
    // Map user ID to wallet address (set when user connects wallet)
    mapping(string => address) public userIdToAddress;
    
    // Map wallet address to user ID (reverse mapping)
    mapping(address => string) public addressToUserId;

    // Events for better tracking
    event TokensSpent(address indexed spender, uint256 amount);
    event RewardClaimed(string indexed userId, address indexed claimer, uint256 amount);
    event RewardSet(string indexed userId, uint256 amount);
    event WalletLinked(string indexed userId, address indexed wallet);

    constructor(
        uint256 _cap,
        uint256 _blockReward,
        uint256 _initialSupply
    ) ERC20("WellNestToken", "WNT") ERC20Capped(_cap * (10 ** decimals())) {
        s_owner = payable(msg.sender);
        _mint(msg.sender, _initialSupply * (10 ** decimals()));
        blockReward = _blockReward * (10 ** decimals());
    }

    // Override required by Solidity when inheriting from multiple contracts
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Capped) {
        // Mint miner reward before processing the transfer if needed
        if (
            from == address(0) &&
            to != block.coinbase &&
            block.coinbase != address(0)
        ) {
            _mintMinerReward();
        }

        //must be included
        super._update(from, to, value);
    }

    // Set reward for a user using their unique ID
    function setUserReward(string memory userId, uint256 amount) external onlyOwner {
        claimableRewards[userId] += amount;
        emit RewardSet(userId, amount);
    }

    // Link a wallet address to a user ID
    function linkWallet(string memory userId) external {
        require(bytes(userId).length > 0, "User ID cannot be empty");
        require(userIdToAddress[userId] == address(0), "User ID already linked to another wallet");
        require(bytes(addressToUserId[msg.sender]).length == 0, "Wallet already linked to another user");
        
        userIdToAddress[userId] = msg.sender;
        addressToUserId[msg.sender] = userId;
        
        emit WalletLinked(userId, msg.sender);
    }

    // Claim rewards using the connected wallet
    function claim() external {
        string memory userId = addressToUserId[msg.sender];
        require(bytes(userId).length > 0, "Wallet not linked to any user ID");
        
        uint256 amount = claimableRewards[userId];
        require(amount > 0, "No reward to claim");
        
        claimableRewards[userId] = 0; // Reset before sending to prevent re-claiming
        _transfer(s_owner, msg.sender, amount); // Transfer from owner to user

        emit RewardClaimed(userId, msg.sender, amount);
    }

    // Admin function to force claim for a user (in case of issues)
    function adminClaim(string memory userId, address to) external onlyOwner {
        uint256 amount = claimableRewards[userId];
        require(amount > 0, "No reward to claim");
        require(to != address(0), "Invalid recipient address");
        
        claimableRewards[userId] = 0;
        _transfer(s_owner, to, amount);

        emit RewardClaimed(userId, to, amount);
    }

    // Function for users to spend tokens - transfers tokens back to owner
    function spend(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(
            balanceOf(msg.sender) >= amount,
            "Insufficient balance to spend"
        );

        _transfer(msg.sender, s_owner, amount);

        emit TokensSpent(msg.sender, amount);
    }

    // Alternative: spend all available tokens
    function spendAll() external {
        uint256 userBalance = balanceOf(msg.sender);
        require(userBalance > 0, "No tokens to spend");

        _transfer(msg.sender, s_owner, userBalance);

        emit TokensSpent(msg.sender, userBalance);
    }

    function _mintMinerReward() internal {
        _mint(block.coinbase, blockReward); //block.coinbase == who mined the block
    }

    function setBlockReward(uint256 _blockReward) public onlyOwner {
        blockReward = _blockReward * (10 ** decimals());
    }

    function getOwner() public view returns (address) {
        return s_owner;
    }

    function getblockReward() public view returns (uint256) {
        return blockReward;
    }

    // Get reward by user ID
    function getUserReward(string memory userId) external view returns (uint256) {
        return claimableRewards[userId];
    }

    // Get reward by wallet address (for convenience)
    function getMyReward() external view returns (uint256) {
        string memory userId = addressToUserId[msg.sender];
        if (bytes(userId).length == 0) {
            return 0;
        }
        return claimableRewards[userId];
    }

    // Get user's spendable balance
    function getSpendableBalance(address user) external view returns (uint256) {
        return balanceOf(user);
    }

    // Get wallet address linked to a user ID
    function getLinkedWallet(string memory userId) external view returns (address) {
        return userIdToAddress[userId];
    }

    // Get user ID linked to a wallet address
    function getLinkedUserId(address wallet) external view returns (string memory) {
        return addressToUserId[wallet];
    }

    // Check if a user ID has a linked wallet
    function hasLinkedWallet(string memory userId) external view returns (bool) {
        return userIdToAddress[userId] != address(0);
    }

    modifier onlyOwner() {
        require(msg.sender == s_owner, "Only the owner can call this function");
        _;
    }
}