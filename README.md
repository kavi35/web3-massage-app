# Blockchain Messenger - Base L2

A simple decentralized messaging application built on Base L2 network that allows users to send messages through their blockchain wallet.

## Features

✨ **Wallet Connection** - Connect MetaMask or other Web3 wallets
⚡ **Base L2 Support** - Send messages on the fast and cheap Base L2 network
💾 **Local Fallback** - Messages stored locally before contract deployment
🔒 **Secure** - Blockchain-verified messaging
📱 **Responsive Design** - Works on desktop and mobile

## Quick Start

### Prerequisites

- MetaMask or another Ethereum-compatible Web3 wallet
- ETH on Base L2 network (for transaction fees)

### Using the Application

1. **Open `index.html`** in your web browser
2. **Click "Connect Wallet"** to connect your MetaMask
3. **Switch to Base Network** (if not already on it)
4. **Paste recipient's wallet address** in the input field
5. **Type your message** (up to 500 characters)
6. **Click "Send Message"**

### How It Works

#### Without Smart Contract (Local Storage)

- Messages are stored in browser's local storage
- Works immediately without blockchain deployment
- Perfect for testing and development

#### With Smart Contract (On-Chain)

1. Deploy the smart contract to Base L2
2. Update `CONTRACT_ADDRESS` in `script.js`
3. Messages are stored on the blockchain permanently

## Smart Contract Deployment

### Option 1: Using Hardhat

```bash
# Install dependencies
npm install -D hardhat @nomiclabs/hardhat-ethers ethers

# Initialize Hardhat
npx hardhat

# Create hardhat.config.js with Base configuration
```

**hardhat.config.js example:**

```javascript
module.exports = {
  solidity: "0.8.0",
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: ["YOUR_PRIVATE_KEY"],
      chainId: 8453,
    },
  },
};
```

### Option 2: Using Remix IDE

1. Go to [Remix IDE](https://remix.ethereum.org)
2. Copy the contents of `contracts/BlockchainMessenger.sol`
3. Create a new file and paste the code
4. Compile the contract (Solidity 0.8.0 or higher)
5. Deploy to Base network through MetaMask

### Option 3: Using Basescan

1. Visit [Basescan](https://basescan.org)
2. Use the "Verify & Publish" section
3. Deploy contract directly

## Configuration

### Network Details

**Base Mainnet:**

- Chain ID: 8453
- RPC URL: `https://mainnet.base.org`
- Block Explorer: `https://basescan.org`

**Base Sepolia (Testnet):**

- Chain ID: 84532
- RPC URL: `https://sepolia.base.org`
- Block Explorer: `https://sepolia.basescan.org`
- Faucet: [Base Sepolia Faucet](https://www.basesepolia.org/)

### Update Contract Address

After deploying the smart contract, update `script.js`:

```javascript
const CONTRACT_ADDRESS = "0x..."; // Your deployed contract address
```

## File Structure

```
msg/
├── index.html              # Main HTML page
├── style.css               # Styling
├── script.js               # Frontend logic & Web3 integration
├── contracts/
│   └── BlockchainMessenger.sol # Smart contract
└── README.md              # This file
```

## API Reference

### Smart Contract Functions

**sendMessage(address recipient, string message)**

- Sends a message to another address
- Parameters:
  - `recipient`: Wallet address of message recipient
  - `message`: Message content (max 500 chars)
- Emits: `MessageSent` event

**getReceivedMessages(address user)**

- Get all messages received by a user
- Returns: Array of Message structs

**getMessage(address user, uint256 index)**

- Get a specific message by index
- Parameters:
  - `user`: Recipient address
  - `index`: Message index in inbox

**getMessageCount(address user)**

- Get total number of messages received
- Returns: Uint256 message count

## Gas Optimization Tips

1. **Keep messages short** - Shorter messages = lower gas fees
2. **Send during low-traffic times** - Gas prices fluctuate
3. **Use Base L2** - Much cheaper than Ethereum mainnet
   - Average message: ~50,000-100,000 gas at ~0.01 gwei = ~$0.01

## Troubleshooting

### "Contract not deployed" Message

- Solution: Messages are stored locally. Deploy the smart contract or ignore this message.

### MetaMask Connection Issues

- Ensure MetaMask is installed and unlocked
- Refresh the page
- Check that you're on the correct network

### Transaction Fails

- Insufficient gas - Ensure you have ETH for gas fees
- Invalid recipient - Check recipient address format (0x...)
- Empty message - Ensure message is not empty

### Wrong Network

- MetaMask will automatically prompt to switch to Base L2
- Or manually add Base network to your wallet

## Security Considerations

⚠️ **Important:**

- Never share your private key
- Only approve transactions you understand
- Messages sent are permanent and public on-chain
- Use testnet (Base Sepolia) for testing before mainnet

## Future Enhancements

- 💬 Message threads and conversations
- 👥 User profiles and verification
- 🔐 Encrypted messaging
- 📧 Message notifications
- ✅ Read receipts
- 🌐 IPFS integration for larger messages
- 💰 Token-gated messaging

## License

MIT License - Feel free to use and modify

## Support

For issues with:

- **MetaMask**: [MetaMask Support](https://support.metamask.io/)
- **Base**: [Base Documentation](https://docs.base.org/)
- **Solidity**: [Solidity Docs](https://docs.soliditylang.org/)

## Resources

- [Base Network Docs](https://docs.base.org/)
- [Ethers.js Docs](https://docs.ethers.org/v6/)
- [MetaMask Docs](https://docs.metamask.io/)
- [Solidity by Example](https://solidity-by-example.org/)

---

**Made with ❤️ for the Base L2 community**
