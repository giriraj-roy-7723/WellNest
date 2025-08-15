const { ethers } = require("ethers");
require("dotenv").config();

// 1. Connect to RPC (e.g., Infura, Alchemy, or local Hardhat node)
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

// 2. Create wallet instance from private key
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// 3. Load contract
const contractDetails = require("./contract-details/details.json"); // ABI file from hardhat artifacts
const contractABI = contractDetails.abi;
const contractAddress = contractDetails.address;

const contract = new ethers.Contract(contractAddress, contractABI, wallet);

// 4. Function to set reward
async function setUserReward(userAddress, rewardAmount) {
  try {
    const tx = await contract.setUserReward(
      userAddress,
      ethers.parseEther(rewardAmount.toString())
    );
    await tx.wait();
    console.log(`✅ Reward set for ${userAddress} with ${rewardAmount} tokens`);
    return tx.hash;
  } catch (error) {
    console.error("❌ Error setting reward:", error);
    throw error;
  }
}

module.exports = { setUserReward };
