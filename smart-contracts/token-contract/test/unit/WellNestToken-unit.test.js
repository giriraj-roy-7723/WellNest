const { assert, expect } = require("chai");
const { network, getNamedAccounts, deployments, ethers } = require("hardhat");
const {
  developmentChains,
  CAP,
  BLOCK_REWARD,
  INITIAL_SUPPLY,
} = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("WellNestToken Unit Test", function () {
      //Multipler is used to make reading the math easier because of the 18 decimal points
      const multiplier = 10 ** 18;
      let wellnestToken, deployer, user1, user2;

      // Test user IDs (simulating MongoDB ObjectIds)
      const testUserId1 = "user123mongodb";
      const testUserId2 = "user456mongodb";

      beforeEach(async function () {
        // Fix: Get accounts using ethers.getSigners() instead of getNamedAccounts()
        const accounts = await ethers.getSigners();
        deployer = accounts[0].address;
        user1 = accounts[1].address;
        user2 = accounts[2].address;

        await deployments.fixture("all");
        const wellnestTokenDeployment = await deployments.get("WellNestToken");
        wellnestToken = await ethers.getContractAt(
          "WellNestToken",
          wellnestTokenDeployment.address
        );
      });

      it("was deployed", async () => {
        assert(wellnestToken.target);
      });

      describe("constructor", () => {
        it("Should set the right Owner ", async () => {
          console.log(deployer);
          expect(await wellnestToken.getOwner()).to.equal(deployer);
        });
        it("Should have correct INITIAL_SUPPLY of token ", async () => {
          const totalSupply = await wellnestToken.totalSupply();
          assert.equal(totalSupply.toString(), INITIAL_SUPPLY * 1e18);
        });
        it("Should have correct CAP of token ", async () => {
          const cap = await wellnestToken.cap();
          assert.equal(cap.toString(), CAP * 1e18);
        });
        it("Should have correct BLOCK_REWARD of token ", async () => {
          const reward = await wellnestToken.getblockReward();
          assert.equal(reward.toString(), BLOCK_REWARD * 1e18);
        });
        it("initializes the token with the correct name and symbol ", async () => {
          const name = (await wellnestToken.name()).toString();
          assert.equal(name, "WellNestToken");

          const symbol = (await wellnestToken.symbol()).toString();
          assert.equal(symbol, "WNT");
        });
      });

      describe("transfers", () => {
        it("Should be able to transfer tokens successfully to an address", async () => {
          const tokensToSend = ethers.parseEther("10");
          await wellnestToken.transfer(user1, tokensToSend);
          expect(await wellnestToken.balanceOf(user1)).to.equal(tokensToSend);
        });
        it("emits an transfer event, when an transfer occurs", async () => {
          await expect(
            wellnestToken.transfer(user1, (10 * multiplier).toString())
          ).to.emit(wellnestToken, "Transfer");
        });
      });

      describe("Wallet Linking System", () => {
        it("should allow user to link their wallet to user ID", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          await expect(user1Contract.linkWallet(testUserId1))
            .to.emit(wellnestToken, "WalletLinked")
            .withArgs(testUserId1, user1);

          // Verify mapping
          expect(await wellnestToken.getLinkedWallet(testUserId1)).to.equal(
            user1
          );
          expect(await wellnestToken.getLinkedUserId(user1)).to.equal(
            testUserId1
          );
          expect(await wellnestToken.hasLinkedWallet(testUserId1)).to.be.true;
        });

        it("should prevent linking same user ID to multiple wallets", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user2Signer = accounts[2];

          const user1Contract = await wellnestToken.connect(user1Signer);
          const user2Contract = await wellnestToken.connect(user2Signer);

          // First user links successfully
          await user1Contract.linkWallet(testUserId1);

          // Second user trying to link same user ID should fail
          await expect(
            user2Contract.linkWallet(testUserId1)
          ).to.be.revertedWith("User ID already linked to another wallet");
        });

        it("should prevent linking same wallet to multiple user IDs", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          // First link
          await user1Contract.linkWallet(testUserId1);

          // Same wallet trying to link different user ID should fail
          await expect(
            user1Contract.linkWallet(testUserId2)
          ).to.be.revertedWith("Wallet already linked to another user");
        });

        it("should reject empty user ID", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          await expect(user1Contract.linkWallet("")).to.be.revertedWith(
            "User ID cannot be empty"
          );
        });
      });

      describe("Reward system Test", () => {
        it("sets the user reward correctly using user ID", async () => {
          const reward = ethers.parseEther("1");

          await expect(wellnestToken.setUserReward(testUserId1, reward))
            .to.emit(wellnestToken, "RewardSet")
            .withArgs(testUserId1, reward);

          const userReward = await wellnestToken.getUserReward(testUserId1);
          assert.equal(reward.toString(), userReward.toString());
        });

        it("accumulates rewards when set multiple times", async () => {
          const reward1 = ethers.parseEther("1");
          const reward2 = ethers.parseEther("0.5");

          await wellnestToken.setUserReward(testUserId1, reward1);
          await wellnestToken.setUserReward(testUserId1, reward2);

          const totalReward = await wellnestToken.getUserReward(testUserId1);
          assert.equal((reward1 + reward2).toString(), totalReward.toString());
        });

        it("reverts when user tries to claim without linking wallet", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          // Set reward but don't link wallet
          const reward = ethers.parseEther("1");
          await wellnestToken.setUserReward(testUserId1, reward);

          await expect(user1Contract.claim()).to.be.revertedWith(
            "Wallet not linked to any user ID"
          );
        });

        it("reverts when no reward is available to claim", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          // Link wallet but don't set any rewards
          await user1Contract.linkWallet(testUserId1);

          await expect(user1Contract.claim()).to.be.revertedWith(
            "No reward to claim"
          );
        });

        it("Lets the user claim rewards after linking wallet", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          // Set reward using user ID
          const reward = ethers.parseEther("1");
          await wellnestToken.setUserReward(testUserId1, reward);

          // Link wallet to user ID
          await user1Contract.linkWallet(testUserId1);

          const startBalance = await wellnestToken.balanceOf(user1);

          // Claim rewards
          await expect(user1Contract.claim())
            .to.emit(wellnestToken, "RewardClaimed")
            .withArgs(testUserId1, user1, reward);

          const endBalance = await wellnestToken.balanceOf(user1);
          assert.equal(
            (startBalance + reward).toString(),
            endBalance.toString()
          );

          // Verify reward is reset to 0 after claiming
          const remainingReward =
            await wellnestToken.getUserReward(testUserId1);
          assert.equal(remainingReward.toString(), "0");
        });

        it("should allow checking rewards using getMyReward after linking wallet", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          const reward = ethers.parseEther("2");
          await wellnestToken.setUserReward(testUserId1, reward);

          // Before linking wallet
          let myReward = await user1Contract.getMyReward();
          assert.equal(myReward.toString(), "0");

          // After linking wallet
          await user1Contract.linkWallet(testUserId1);
          myReward = await user1Contract.getMyReward();
          assert.equal(myReward.toString(), reward.toString());
        });

        it("should allow admin to force claim for a user", async () => {
          const reward = ethers.parseEther("1");
          await wellnestToken.setUserReward(testUserId1, reward);

          const startBalance = await wellnestToken.balanceOf(user1);

          // Admin claims on behalf of user to their address
          await expect(wellnestToken.adminClaim(testUserId1, user1))
            .to.emit(wellnestToken, "RewardClaimed")
            .withArgs(testUserId1, user1, reward);

          const endBalance = await wellnestToken.balanceOf(user1);
          assert.equal(
            (startBalance + reward).toString(),
            endBalance.toString()
          );
        });

        it("should revert admin claim with invalid address", async () => {
          const reward = ethers.parseEther("1");
          await wellnestToken.setUserReward(testUserId1, reward);

          await expect(
            wellnestToken.adminClaim(testUserId1, ethers.ZeroAddress)
          ).to.be.revertedWith("Invalid recipient address");
        });
      });

      describe("allowances", () => {
        const amount = (20 * multiplier).toString();
        let playerToken; // Fix: Declare playerToken properly
        beforeEach(async () => {
          // Fix: Get the signer object for user1
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];

          const wellnestTokenDeployment =
            await deployments.get("WellNestToken");
          playerToken = await ethers.getContractAt(
            "WellNestToken",
            wellnestTokenDeployment.address,
            user1Signer // Use the signer object, not just the address
          );
        });
        it("Should approve other address to spend token", async () => {
          const tokensToSpend = ethers.parseEther("5");
          //Deployer is approving that user1 can spend 5 of their precious OT's
          await wellnestToken.approve(user1, tokensToSpend);
          await playerToken.transferFrom(deployer, user1, tokensToSpend);
          expect(await playerToken.balanceOf(user1)).to.equal(tokensToSpend);
        });
        it("doesn't allow an unnaproved member to do transfers", async () => {
          await expect(
            playerToken.transferFrom(deployer, user1, amount)
          ).to.be.revertedWithCustomError(
            playerToken,
            "ERC20InsufficientAllowance"
          );
        });
        it("emits an approval event, when an approval occurs", async () => {
          await expect(wellnestToken.approve(user1, amount)).to.emit(
            wellnestToken,
            "Approval"
          );
        });
        it("the allowance being set is accurate", async () => {
          await wellnestToken.approve(user1, amount);
          const allowance = await wellnestToken.allowance(deployer, user1);
          assert.equal(allowance.toString(), amount);
        });
        it("won't allow a user to go over the allowance", async () => {
          await wellnestToken.approve(user1, amount);
          await expect(
            playerToken.transferFrom(
              deployer,
              user1,
              (40 * multiplier).toString()
            )
          ).to.be.revertedWithCustomError(
            playerToken,
            "ERC20InsufficientAllowance"
          );
        });
      });

      // NEW TESTS FOR SPEND FUNCTIONALITY
      describe("Spend system Test", () => {
        let user1Contract;

        beforeEach(async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];

          const wellnestTokenDeployment =
            await deployments.get("WellNestToken");
          user1Contract = await ethers.getContractAt(
            "WellNestToken",
            wellnestTokenDeployment.address,
            user1Signer
          );

          // Give user1 some tokens to spend (transfer from deployer)
          const tokensToGive = ethers.parseEther("50");
          await wellnestToken.transfer(user1, tokensToGive);
        });

        it("should allow user to spend tokens and transfer them to owner", async () => {
          const amountToSpend = ethers.parseEther("10");

          // Get initial balances
          const initialUserBalance = await wellnestToken.balanceOf(user1);
          const initialOwnerBalance = await wellnestToken.balanceOf(deployer);

          // User spends tokens
          await user1Contract.spend(amountToSpend);

          // Check final balances
          const finalUserBalance = await wellnestToken.balanceOf(user1);
          const finalOwnerBalance = await wellnestToken.balanceOf(deployer);

          assert.equal(
            (initialUserBalance - amountToSpend).toString(),
            finalUserBalance.toString()
          );
          assert.equal(
            (initialOwnerBalance + amountToSpend).toString(),
            finalOwnerBalance.toString()
          );
        });

        it("should emit TokensSpent event when user spends tokens", async () => {
          const amountToSpend = ethers.parseEther("5");

          await expect(user1Contract.spend(amountToSpend))
            .to.emit(wellnestToken, "TokensSpent")
            .withArgs(user1, amountToSpend);
        });

        it("should revert when user tries to spend 0 tokens", async () => {
          await expect(user1Contract.spend(0)).to.be.revertedWith(
            "Amount must be greater than 0"
          );
        });

        it("should revert when user tries to spend more than their balance", async () => {
          const userBalance = await wellnestToken.balanceOf(user1);
          const excessiveAmount = userBalance + ethers.parseEther("1");

          await expect(user1Contract.spend(excessiveAmount)).to.be.revertedWith(
            "Insufficient balance to spend"
          );
        });

        it("should allow user to spend all tokens using spendAll function", async () => {
          // Get initial balances
          const initialUserBalance = await wellnestToken.balanceOf(user1);
          const initialOwnerBalance = await wellnestToken.balanceOf(deployer);

          // User spends all tokens
          await user1Contract.spendAll();

          // Check final balances
          const finalUserBalance = await wellnestToken.balanceOf(user1);
          const finalOwnerBalance = await wellnestToken.balanceOf(deployer);

          assert.equal(finalUserBalance.toString(), "0");
          assert.equal(
            (initialOwnerBalance + initialUserBalance).toString(),
            finalOwnerBalance.toString()
          );
        });

        it("should emit TokensSpent event when user spends all tokens", async () => {
          const userBalance = await wellnestToken.balanceOf(user1);

          await expect(user1Contract.spendAll())
            .to.emit(wellnestToken, "TokensSpent")
            .withArgs(user1, userBalance);
        });

        it("should revert when user with 0 balance tries to spend all", async () => {
          // First spend all tokens
          await user1Contract.spendAll();

          // Try to spend all again (should fail)
          await expect(user1Contract.spendAll()).to.be.revertedWith(
            "No tokens to spend"
          );
        });

        it("should return correct spendable balance", async () => {
          const userBalance = await wellnestToken.balanceOf(user1);
          const spendableBalance =
            await wellnestToken.getSpendableBalance(user1);

          assert.equal(userBalance.toString(), spendableBalance.toString());
        });

        it("should update spendable balance after spending", async () => {
          const amountToSpend = ethers.parseEther("15");
          const initialSpendableBalance =
            await wellnestToken.getSpendableBalance(user1);

          await user1Contract.spend(amountToSpend);

          const finalSpendableBalance =
            await wellnestToken.getSpendableBalance(user1);

          assert.equal(
            (initialSpendableBalance - amountToSpend).toString(),
            finalSpendableBalance.toString()
          );
        });
      });

      describe("Integration Test: Full User Journey", () => {
        it("should handle complete user journey: set reward → link wallet → claim", async () => {
          const accounts = await ethers.getSigners();
          const user1Signer = accounts[1];
          const user1Contract = await wellnestToken.connect(user1Signer);

          // Step 1: Admin sets reward for user ID (user doesn't have wallet yet)
          const reward = ethers.parseEther("5");
          await wellnestToken.setUserReward(testUserId1, reward);

          // Verify reward is stored
          let userReward = await wellnestToken.getUserReward(testUserId1);
          assert.equal(userReward.toString(), reward.toString());

          // Step 2: User creates wallet and links it
          await user1Contract.linkWallet(testUserId1);

          // Step 3: User can now check their rewards
          const myReward = await user1Contract.getMyReward();
          assert.equal(myReward.toString(), reward.toString());

          // Step 4: User claims their rewards
          const initialBalance = await wellnestToken.balanceOf(user1);
          await user1Contract.claim();
          const finalBalance = await wellnestToken.balanceOf(user1);

          assert.equal(
            (initialBalance + reward).toString(),
            finalBalance.toString()
          );

          // Verify reward is now 0
          userReward = await wellnestToken.getUserReward(testUserId1);
          assert.equal(userReward.toString(), "0");
        });
      });
    });
