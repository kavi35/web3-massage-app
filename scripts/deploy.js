// scripts/deploy.js
// Deploy contract to Base L2

const hre = require("hardhat");

async function main() {
  console.log(
    "Deploying BlockchainMessenger contract to",
    hre.network.name,
    "...",
  );

  try {
    // Get signer
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contract with account:", deployer.address);

    // Get account balance
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

    // Deploy contract
    const BlockchainMessenger = await hre.ethers.getContractFactory(
      "BlockchainMessenger",
    );
    const contract = await BlockchainMessenger.deploy();

    await contract.waitForDeployment();
    const deployedAddress = await contract.getAddress();

    console.log("\n✅ Contract deployed successfully!");
    console.log("Contract address:", deployedAddress);
    console.log("\nNetwork:", hre.network.name);
    console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);

    // Instructions for updating the frontend
    console.log("\n📝 Update your script.js with:");
    console.log(`const CONTRACT_ADDRESS = "${deployedAddress}";`);

    // View contract on Basescan
    const networkName = hre.network.name;
    let explorerUrl;
    if (networkName === "base") {
      explorerUrl = `https://basescan.org/address/${deployedAddress}`;
    } else if (networkName === "baseSepolia") {
      explorerUrl = `https://sepolia.basescan.org/address/${deployedAddress}`;
    }

    if (explorerUrl) {
      console.log("\n🔍 View contract on Basescan:");
      console.log(explorerUrl);
    }

    // Optional: Verify contract on Basescan
    console.log("\n📚 To verify contract on Basescan, run:");
    console.log(
      `npx hardhat verify --network ${networkName} ${deployedAddress}`,
    );
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
