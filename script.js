// Network Configuration
const NETWORKS = {
  "base-mainnet": {
    chainId: 8453,
    chainIdHex: "0x2105",
    rpcUrl: "https://mainnet.base.org",
    name: "Base Mainnet",
    contractAddress: "0xE28CB05F55438Cc2F878CF962CF5CA8B38a88418", // Deployed on Base Mainnet
    explorerUrl: "https://basescan.org",
    symbol: "ETH",
  },
  "base-sepolia": {
    chainId: 84532,
    chainIdHex: "0x14a34",
    rpcUrl: "https://sepolia.base.org",
    name: "Base Sepolia (Testnet)",
    contractAddress: "0x5C2f1E2c7094E65AAA3cF2dfd612A685b2C9D5a9", // Deployed on Base Sepolia
    explorerUrl: "https://sepolia.basescan.org",
    symbol: "ETH",
  },
};

let selectedNetwork = "base-mainnet"; // Default network
let CONTRACT_ADDRESS = NETWORKS[selectedNetwork].contractAddress;
let BASE_CHAIN_ID = NETWORKS[selectedNetwork].chainId;
let BASE_RPC = NETWORKS[selectedNetwork].rpcUrl;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Simple Message Contract ABI
const CONTRACT_ABI = [
  "function sendMessage(address recipient, string memory message) public",
  "function getReceivedMessages(address user) public view returns (tuple(address sender, address recipient, string messageText, uint256 timestamp)[])",
  "function getSentMessages(address user) public view returns (tuple(address sender, address recipient, string messageText, uint256 timestamp)[])",
  "function getTotalMessageCount() public view returns (uint256)",
  "event MessageSent(indexed address sender, indexed address recipient, string messageText, uint256 timestamp)",
];

let currentAccount = null;
let provider = null;
let signer = null;
let contract = null;

// Elements
const connectBtn = document.getElementById("connectBtn");
const disconnectBtn = document.getElementById("disconnectBtn");
const walletInfo = document.getElementById("walletInfo");
const walletAddress = document.getElementById("walletAddress");
const networkStatus = document.getElementById("networkStatus");
const networkInfo = document.getElementById("networkInfo");
const messageForm = document.getElementById("messageForm");
const sendBtn = document.getElementById("sendBtn");
const messagesList = document.getElementById("messagesList");
const sentMessagesList = document.getElementById("sentMessagesList");
const charCount = document.getElementById("charCount");
const messageText = document.getElementById("messageText");
const notification = document.getElementById("notification");
const networkSelect = document.getElementById("networkSelect");

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Wait for ethers to be defined
  if (typeof ethers === "undefined") {
    console.error("Ethers.js not loaded. Retrying...");
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    return;
  }

  connectBtn.addEventListener("click", connectWallet);
  disconnectBtn.addEventListener("click", disconnectWallet);
  messageForm.addEventListener("submit", sendMessage);
  messageText.addEventListener("input", updateCharCount);
  networkSelect.addEventListener("change", handleNetworkChange);

  // Check if wallet is already connected
  checkIfWalletConnected();

  // Listen for account changes
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
  }
});

async function checkIfWalletConnected() {
  if (typeof window.ethereum !== "undefined") {
    try {
      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });
      if (accounts.length > 0) {
        await connectWallet();
      }
    } catch (err) {
      console.log("Not connected:", err);
    }
  }
}

function hasDeployedContract() {
  return CONTRACT_ADDRESS !== ZERO_ADDRESS;
}

async function connectWallet() {
  if (typeof window.ethereum === "undefined") {
    showNotification(
      "MetaMask is not installed. Please install it first.",
      "error",
    );
    return;
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    currentAccount = accounts[0];

    // Initialize ethers.js
    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    // Check network
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(BASE_CHAIN_ID)) {
      await switchToBaseNetwork();
      // Re-initialize provider and signer after network switch
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
    }

    // Initialize contract (use provider for read-only initially)
    // Note: Contract address would be set after deployment
    if (hasDeployedContract()) {
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      await loadMessages();
      await loadSentMessages();
    } else {
      contract = null;
      showNotification(
        `No deployed contract found for ${NETWORKS[selectedNetwork].name}. Deploy first, then update contractAddress in script.js.`,
        "warning",
      );
      await loadMessages();
      await loadSentMessages();
    }

    // Update UI
    updateWalletUI();
    sendBtn.disabled = false;

    showNotification(
      `Wallet connected: ${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`,
      "success",
    );
  } catch (error) {
    if (error.code === -32602) {
      showNotification("Failed to connect wallet. Please try again.", "error");
    } else if (error.code === -32002) {
      showNotification("Please unlock your wallet.", "warning");
    } else {
      showNotification(`Error: ${error.message}`, "error");
    }
  }
}

async function switchToBaseNetwork() {
  const network = NETWORKS[selectedNetwork];
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: network.chainIdHex }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      // Chain not added, try to add it
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: network.chainIdHex,
              chainName: network.name,
              rpcUrls: [network.rpcUrl],
              nativeCurrency: {
                name: "Ether",
                symbol: network.symbol,
                decimals: 18,
              },
              blockExplorerUrls: [network.explorerUrl],
            },
          ],
        });
      } catch (addError) {
        showNotification(`Failed to add ${network.name} network.`, "error");
        throw addError;
      }
    } else {
      throw switchError;
    }
  }
}

async function handleNetworkChange(event) {
  selectedNetwork = event.target.value;
  const network = NETWORKS[selectedNetwork];

  // Update global variables
  CONTRACT_ADDRESS = network.contractAddress;
  BASE_CHAIN_ID = network.chainId;
  BASE_RPC = network.rpcUrl;

  showNotification(`Network switched to ${network.name}`, "info");

  // If wallet is connected, switch to the new network
  if (currentAccount) {
    try {
      await switchToBaseNetwork();

      // Reinitialize provider and signer for the new network
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();

      // Reinitialize contract with new network
      if (hasDeployedContract()) {
        contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      } else {
        contract = null;
        showNotification(
          `No deployed contract found for ${network.name}. Deploy first, then update contractAddress in script.js.`,
          "warning",
        );
      }

      updateWalletUI();
      await loadMessages();
      await loadSentMessages();
    } catch (error) {
      showNotification(`Failed to switch network: ${error.message}`, "error");
    }
  }
}

function disconnectWallet() {
  currentAccount = null;
  provider = null;
  signer = null;
  contract = null;

  walletInfo.style.display = "none";
  networkStatus.style.display = "none";
  connectBtn.style.display = "block";
  sendBtn.disabled = true;
  networkSelect.disabled = false; // Enable network selection when disconnected
  messagesList.innerHTML =
    '<p class="empty-state">Wallet disconnected. Connect to view messages.</p>';
  sentMessagesList.innerHTML =
    '<p class="empty-state">Wallet disconnected. Connect to view messages.</p>';

  showNotification("Wallet disconnected", "info");
}

function updateWalletUI() {
  walletAddress.textContent = currentAccount;
  walletInfo.style.display = "block";
  connectBtn.style.display = "none";

  networkStatus.style.display = "block";
  const network = NETWORKS[selectedNetwork];
  networkInfo.textContent = `✓ Connected to ${network.name}`;
}

async function sendMessage(event) {
  event.preventDefault();

  if (!currentAccount) {
    showNotification("Please connect wallet first.", "warning");
    return;
  }

  const recipientAddress = document.getElementById("recipientAddress").value;
  const messageContent = messageText.value;

  // Validate recipient address
  if (!ethers.isAddress(recipientAddress)) {
    showNotification("Invalid recipient address.", "error");
    return;
  }

  if (messageContent.trim().length === 0) {
    showNotification("Message cannot be empty.", "error");
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    if (contract) {
      // Send through smart contract
      const tx = await contract.sendMessage(recipientAddress, messageContent);
      showNotification("Transaction sent! Waiting for confirmation...", "info");
      await tx.wait();

      // Also save to local storage for immediate display
      await sendMessageLocally(
        currentAccount,
        recipientAddress,
        messageContent,
      );

      showNotification("Message sent successfully!", "success");
    } else {
      // Use local storage fallback
      await sendMessageLocally(
        currentAccount,
        recipientAddress,
        messageContent,
      );
      showNotification("Message saved locally!", "success");
    }

    // Clear form
    messageForm.reset();
    updateCharCount();

    // Reload messages
    await loadMessages();
    await loadSentMessages();
  } catch (error) {
    console.error("Send error:", error);
    if (error.reason) {
      showNotification(`Transaction failed: ${error.reason}`, "error");
    } else {
      showNotification(`Error: ${error.message}`, "error");
    }
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send Message";
  }
}

function updateCharCount() {
  const length = messageText.value.length;
  charCount.textContent = `${length}/500 characters`;
  charCount.style.color = length > 400 ? "#ff9800" : "#999";
}

async function loadMessages() {
  if (!currentAccount) {
    messagesList.innerHTML =
      '<p class="empty-state">Connect wallet to view messages.</p>';
    return;
  }

  try {
    let messages = [];

    // Try to load from contract if available
    if (contract) {
      try {
        const contractMessages =
          await contract.getReceivedMessages(currentAccount);
        messages = contractMessages.map((msg) => ({
          sender: msg.sender,
          recipient: msg.recipient,
          message: msg.messageText,
          timestamp: Number(msg.timestamp),
        }));
      } catch (contractError) {
        console.log(
          "Could not fetch from contract, using local storage:",
          contractError,
        );
        messages = getMessagesFromLocalStorage(currentAccount);
      }
    } else {
      // Fallback to local storage
      messages = getMessagesFromLocalStorage(currentAccount);
    }

    if (messages.length === 0) {
      messagesList.innerHTML =
        '<p class="empty-state">No messages yet. Send one to get started!</p>';
      return;
    }

    messagesList.innerHTML = messages
      .map(
        (msg) => `
            <div class="message-item">
                <div class="message-header">
                    <span class="message-from">From: ${msg.sender.slice(0, 6)}...${msg.sender.slice(-4)}</span>
                    <span class="message-time">${formatDate(msg.timestamp)}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.message)}</div>
            </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Load error:", error);
    messagesList.innerHTML =
      '<p class="empty-state">Error loading messages.</p>';
  }
}

async function loadSentMessages() {
  if (!currentAccount) {
    sentMessagesList.innerHTML =
      '<p class="empty-state">Connect wallet to view sent messages.</p>';
    return;
  }

  try {
    let sentMessages = [];

    // Try to load from contract if available
    if (contract) {
      try {
        const contractMessages = await contract.getSentMessages(currentAccount);
        sentMessages = contractMessages.map((msg) => ({
          sender: msg.sender,
          recipient: msg.recipient,
          message: msg.messageText,
          timestamp: Number(msg.timestamp),
        }));
      } catch (contractError) {
        console.log(
          "Could not fetch from contract, using local storage:",
          contractError,
        );
        sentMessages = getSentMessagesFromLocalStorage(currentAccount);
      }
    } else {
      // Fallback to local storage
      sentMessages = getSentMessagesFromLocalStorage(currentAccount);
    }

    if (sentMessages.length === 0) {
      sentMessagesList.innerHTML =
        '<p class="empty-state">No sent messages yet. Send a message to get started!</p>';
      return;
    }

    sentMessagesList.innerHTML = sentMessages
      .map(
        (msg) => `
            <div class="message-item">
                <div class="message-header">
                    <span class="message-to">To: ${msg.recipient.slice(0, 6)}...${msg.recipient.slice(-4)}</span>
                    <span class="message-time">${formatDate(msg.timestamp)}</span>
                </div>
                <div class="message-content">${escapeHtml(msg.message)}</div>
            </div>
        `,
      )
      .join("");
  } catch (error) {
    console.error("Load sent messages error:", error);
    sentMessagesList.innerHTML =
      '<p class="empty-state">Error loading sent messages.</p>';
  }
}

// Local Storage Functions (fallback when contract not deployed)
function getMessagesFromLocalStorage(address) {
  const allMessages = JSON.parse(
    localStorage.getItem("blockchainMessages") || "[]",
  );
  return allMessages
    .filter((msg) => msg.recipient.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.timestamp - a.timestamp);
}

function getSentMessagesFromLocalStorage(address) {
  const allMessages = JSON.parse(
    localStorage.getItem("blockchainMessages") || "[]",
  );
  return allMessages
    .filter((msg) => msg.sender.toLowerCase() === address.toLowerCase())
    .sort((a, b) => b.timestamp - a.timestamp);
}

function sendMessageLocally(sender, recipient, message) {
  const allMessages = JSON.parse(
    localStorage.getItem("blockchainMessages") || "[]",
  );
  const newMessage = {
    sender: sender,
    recipient: recipient,
    message: message,
    timestamp: Math.floor(Date.now() / 1000),
  };
  allMessages.push(newMessage);
  localStorage.setItem("blockchainMessages", JSON.stringify(allMessages));
  return Promise.resolve();
}

// Utility Functions
function showNotification(message, type = "info") {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 5000);
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else if (accounts[0] !== currentAccount) {
    currentAccount = accounts[0];
    updateWalletUI();
    loadMessages();
    loadSentMessages();
    showNotification(
      `Switched to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
      "info",
    );
  }
}

function handleChainChanged(chainId) {
  // Reload the page
  window.location.reload();
}
