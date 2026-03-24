// Network Configuration
const NETWORKS = {
  "base-mainnet": {
    chainId: 8453,
    chainIdHex: "0x2105",
    rpcUrl: "https://mainnet.base.org",
    name: "Base Mainnet",
    contractAddress: "0xE28CB05F55438Cc2F878CF962CF5CA8B38a88418",
    explorerUrl: "https://basescan.org",
    symbol: "ETH",
  },
  "base-sepolia": {
    chainId: 84532,
    chainIdHex: "0x14a34",
    rpcUrl: "https://sepolia.base.org",
    name: "Base Sepolia (Testnet)",
    contractAddress: "0x5C2f1E2c7094E65AAA3cF2dfd612A685b2C9D5a9",
    explorerUrl: "https://sepolia.basescan.org",
    symbol: "ETH",
  },
};

let selectedNetwork = "base-mainnet";
let CONTRACT_ADDRESS = NETWORKS[selectedNetwork].contractAddress;
let BASE_CHAIN_ID = NETWORKS[selectedNetwork].chainId;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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

let currentUserMessages = [];
let selectedConversationAddress = null;
let conversationSearchTerm = "";

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
const conversationSearch = document.getElementById("conversationSearch");
const conversationList = document.getElementById("conversationList");
const chatMessages = document.getElementById("chatMessages");
const chatTitle = document.getElementById("chatTitle");
const chatPeerBadge = document.getElementById("chatPeerBadge");
const themeToggleBtn = document.getElementById("themeToggleBtn");

document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();

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

  if (conversationSearch) {
    conversationSearch.addEventListener("input", (event) => {
      conversationSearchTerm = event.target.value.trim().toLowerCase();
      renderConversations();
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  checkIfWalletConnected();

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
  }
});

async function checkIfWalletConnected() {
  if (typeof window.ethereum === "undefined") return;

  try {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      await connectWallet();
    }
  } catch (err) {
    console.log("Not connected:", err);
  }
}

function hasDeployedContract() {
  return CONTRACT_ADDRESS !== ZERO_ADDRESS;
}

function getInitialTheme() {
  return "light";
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  if (!themeToggleBtn) return;
  themeToggleBtn.textContent =
    theme === "dark" ? "Switch to Light" : "Switch to Dark";
}

function initializeTheme() {
  applyTheme(getInitialTheme());
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute("data-theme") || "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem("uiTheme", nextTheme);
}

function normalizeAddress(address) {
  return String(address || "").toLowerCase();
}

function shortAddress(address) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function compareAddress(a, b) {
  return normalizeAddress(a) === normalizeAddress(b);
}

function getReadStateKey() {
  return `messageReadState:${normalizeAddress(currentAccount)}:${selectedNetwork}`;
}

function getReadState() {
  if (!currentAccount) return {};
  return JSON.parse(localStorage.getItem(getReadStateKey()) || "{}");
}

function setReadState(nextState) {
  if (!currentAccount) return;
  localStorage.setItem(getReadStateKey(), JSON.stringify(nextState));
}

function markConversationAsRead(peerAddress) {
  if (!peerAddress) return;
  const key = normalizeAddress(peerAddress);
  const conversation = buildConversationThread(peerAddress);
  if (conversation.length === 0) return;

  const latestTimestamp = conversation[conversation.length - 1].timestamp;
  const readState = getReadState();
  readState[key] = latestTimestamp;
  setReadState(readState);
}

function getUnreadCountForPeer(peerAddress) {
  const peerKey = normalizeAddress(peerAddress);
  const readState = getReadState();
  const readUntil = Number(readState[peerKey] || 0);

  return buildConversationThread(peerAddress).filter((msg) => {
    const incoming = compareAddress(msg.recipient, currentAccount);
    return incoming && msg.timestamp > readUntil;
  }).length;
}

function normalizeMessage(msg) {
  return {
    sender: msg.sender,
    recipient: msg.recipient,
    message: msg.message,
    timestamp: Number(msg.timestamp),
  };
}

function dedupeMessages(messages) {
  const seen = new Set();
  return messages.filter((msg) => {
    const key = [
      normalizeAddress(msg.sender),
      normalizeAddress(msg.recipient),
      msg.message,
      Number(msg.timestamp),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    currentAccount = accounts[0];

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(BASE_CHAIN_ID)) {
      await switchToBaseNetwork();
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
    }

    if (hasDeployedContract()) {
      contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    } else {
      contract = null;
      showNotification(
        `No deployed contract found for ${NETWORKS[selectedNetwork].name}. Deploy first, then update contractAddress in script.js.`,
        "warning",
      );
    }

    updateWalletUI();
    sendBtn.disabled = false;

    await refreshMessagesUI();

    showNotification(
      `Wallet connected: ${shortAddress(currentAccount)}`,
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
    } else {
      throw switchError;
    }
  }
}

async function handleNetworkChange(event) {
  selectedNetwork = event.target.value;
  const network = NETWORKS[selectedNetwork];

  CONTRACT_ADDRESS = network.contractAddress;
  BASE_CHAIN_ID = network.chainId;

  showNotification(`Network switched to ${network.name}`, "info");

  if (!currentAccount) return;

  try {
    await switchToBaseNetwork();

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();

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
    await refreshMessagesUI();
  } catch (error) {
    showNotification(`Failed to switch network: ${error.message}`, "error");
  }
}

function disconnectWallet() {
  currentAccount = null;
  provider = null;
  signer = null;
  contract = null;

  currentUserMessages = [];
  selectedConversationAddress = null;

  walletInfo.style.display = "none";
  networkStatus.style.display = "none";
  connectBtn.style.display = "block";
  sendBtn.disabled = true;
  networkSelect.disabled = false;

  messagesList.innerHTML =
    '<p class="empty-state">Wallet disconnected. Connect to view messages.</p>';
  sentMessagesList.innerHTML =
    '<p class="empty-state">Wallet disconnected. Connect to view messages.</p>';
  if (conversationList) {
    conversationList.innerHTML =
      '<p class="empty-state">Connect wallet to view conversations.</p>';
  }
  if (chatMessages) {
    chatMessages.innerHTML =
      '<p class="empty-state">Select a conversation to view chat history.</p>';
  }
  if (chatTitle) {
    chatTitle.textContent = "Conversation";
  }
  if (chatPeerBadge) {
    chatPeerBadge.textContent = "Select a chat";
  }

  showNotification("Wallet disconnected", "info");
}

function updateWalletUI() {
  walletAddress.textContent = currentAccount;
  walletInfo.style.display = "block";
  connectBtn.style.display = "none";

  networkStatus.style.display = "block";
  const network = NETWORKS[selectedNetwork];
  networkInfo.textContent = `Connected to ${network.name}`;
}

async function sendMessage(event) {
  event.preventDefault();

  if (!currentAccount) {
    showNotification("Please connect wallet first.", "warning");
    return;
  }

  const recipientAddress = document.getElementById("recipientAddress").value;
  const messageContent = messageText.value;

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
      const tx = await contract.sendMessage(recipientAddress, messageContent);
      showNotification("Transaction sent. Waiting for confirmation...", "info");
      await tx.wait();
    } else {
      await sendMessageLocally(
        currentAccount,
        recipientAddress,
        messageContent,
      );
    }

    messageForm.reset();
    updateCharCount();

    selectedConversationAddress = recipientAddress;
    await refreshMessagesUI();

    showNotification("Message sent successfully.", "success");
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
  charCount.style.color = length > 400 ? "#b97905" : "#5a667f";
}

async function fetchUserMessages() {
  if (!currentAccount) return [];

  const normalizedCurrent = normalizeAddress(currentAccount);
  let received = [];
  let sent = [];

  if (contract) {
    try {
      const [receivedFromContract, sentFromContract] = await Promise.all([
        contract.getReceivedMessages(currentAccount),
        contract.getSentMessages(currentAccount),
      ]);

      received = receivedFromContract.map((msg) =>
        normalizeMessage({
          sender: msg.sender,
          recipient: msg.recipient,
          message: msg.messageText,
          timestamp: msg.timestamp,
        }),
      );

      sent = sentFromContract.map((msg) =>
        normalizeMessage({
          sender: msg.sender,
          recipient: msg.recipient,
          message: msg.messageText,
          timestamp: msg.timestamp,
        }),
      );
    } catch (contractError) {
      console.log("Contract fetch failed, using local storage:", contractError);
    }
  }

  const localMessages = getAllMessagesFromLocalStorage();

  const relevantLocalMessages = localMessages.filter((msg) => {
    return (
      compareAddress(msg.sender, normalizedCurrent) ||
      compareAddress(msg.recipient, normalizedCurrent)
    );
  });

  const merged = dedupeMessages([
    ...received,
    ...sent,
    ...relevantLocalMessages,
  ]);
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

async function refreshMessagesUI() {
  if (!currentAccount) return;

  currentUserMessages = await fetchUserMessages();

  const receivedMessages = currentUserMessages
    .filter((msg) => compareAddress(msg.recipient, currentAccount))
    .sort((a, b) => b.timestamp - a.timestamp);

  const sentMessages = currentUserMessages
    .filter((msg) => compareAddress(msg.sender, currentAccount))
    .sort((a, b) => b.timestamp - a.timestamp);

  renderInbox(receivedMessages);
  renderSent(sentMessages);

  const conversations = buildConversations();
  if (conversations.length > 0 && !selectedConversationAddress) {
    selectedConversationAddress = conversations[0].peer;
  }

  if (
    selectedConversationAddress &&
    !conversations.some((conversation) =>
      compareAddress(conversation.peer, selectedConversationAddress),
    )
  ) {
    selectedConversationAddress =
      conversations.length > 0 ? conversations[0].peer : null;
  }

  if (selectedConversationAddress) {
    markConversationAsRead(selectedConversationAddress);
  }

  renderConversations();
  renderConversationChat();
}

function renderInbox(messages) {
  if (!messages.length) {
    messagesList.innerHTML =
      '<p class="empty-state">No inbox messages yet.</p>';
    return;
  }

  messagesList.innerHTML = messages
    .map(
      (msg) => `
        <div class="message-item">
          <div class="message-header">
            <span class="message-from">From: ${shortAddress(msg.sender)}</span>
            <span class="message-time">${formatDate(msg.timestamp)}</span>
          </div>
          <div class="message-content">${escapeHtml(msg.message)}</div>
        </div>
      `,
    )
    .join("");
}

function renderSent(messages) {
  if (!messages.length) {
    sentMessagesList.innerHTML =
      '<p class="empty-state">No sent messages yet.</p>';
    return;
  }

  sentMessagesList.innerHTML = messages
    .map(
      (msg) => `
        <div class="message-item">
          <div class="message-header">
            <span class="message-to">To: ${shortAddress(msg.recipient)}</span>
            <span class="message-time">${formatDate(msg.timestamp)}</span>
          </div>
          <div class="message-content">${escapeHtml(msg.message)}</div>
        </div>
      `,
    )
    .join("");
}

function buildConversations() {
  if (!currentAccount) return [];

  const conversationMap = new Map();

  currentUserMessages.forEach((msg) => {
    const outgoing = compareAddress(msg.sender, currentAccount);
    const peer = outgoing ? msg.recipient : msg.sender;
    const key = normalizeAddress(peer);

    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        peer,
        latestMessage: msg,
      });
    } else {
      const existing = conversationMap.get(key);
      if (msg.timestamp > existing.latestMessage.timestamp) {
        existing.latestMessage = msg;
      }
    }
  });

  return Array.from(conversationMap.values())
    .filter((conversation) =>
      normalizeAddress(conversation.peer).includes(conversationSearchTerm),
    )
    .sort((a, b) => b.latestMessage.timestamp - a.latestMessage.timestamp);
}

function renderConversations() {
  const conversations = buildConversations();

  if (!conversations.length) {
    conversationList.innerHTML =
      '<p class="empty-state">No conversations found for this wallet.</p>';
    return;
  }

  conversationList.innerHTML = conversations
    .map((conversation) => {
      const peerAddress = conversation.peer;
      const unread = getUnreadCountForPeer(peerAddress);
      const isActive =
        selectedConversationAddress &&
        compareAddress(selectedConversationAddress, peerAddress);

      return `
        <button
          class="conversation-item ${isActive ? "active" : ""}"
          data-peer="${peerAddress}"
          type="button"
        >
          <div class="conversation-main">
            <span class="conversation-address">${shortAddress(peerAddress)}</span>
            <span class="conversation-preview">${escapeHtml(conversation.latestMessage.message)}</span>
          </div>
          <div class="conversation-meta">
            <span class="message-time">${formatDate(conversation.latestMessage.timestamp)}</span>
            ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ""}
          </div>
        </button>
      `;
    })
    .join("");

  conversationList.querySelectorAll(".conversation-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedConversationAddress = item.getAttribute("data-peer");
      markConversationAsRead(selectedConversationAddress);
      renderConversations();
      renderConversationChat();
    });
  });
}

function buildConversationThread(peerAddress) {
  if (!currentAccount || !peerAddress) return [];

  return currentUserMessages
    .filter((msg) => {
      const a =
        compareAddress(msg.sender, currentAccount) &&
        compareAddress(msg.recipient, peerAddress);
      const b =
        compareAddress(msg.sender, peerAddress) &&
        compareAddress(msg.recipient, currentAccount);
      return a || b;
    })
    .sort((a, b) => a.timestamp - b.timestamp);
}

function renderConversationChat() {
  if (!selectedConversationAddress) {
    chatTitle.textContent = "Conversation";
    chatPeerBadge.textContent = "Select a chat";
    chatMessages.innerHTML =
      '<p class="empty-state">Select a conversation to view chat history.</p>';
    return;
  }

  const peer = selectedConversationAddress;
  const messages = buildConversationThread(peer);

  chatTitle.textContent = `Chat with ${shortAddress(peer)}`;
  chatPeerBadge.textContent = shortAddress(peer);

  if (!messages.length) {
    chatMessages.innerHTML =
      '<p class="empty-state">No messages in this chat.</p>';
    return;
  }

  chatMessages.innerHTML = messages
    .map((msg) => {
      const outgoing = compareAddress(msg.sender, currentAccount);
      return `
        <div class="chat-message ${outgoing ? "outgoing" : "incoming"}">
          <span class="chat-direction">${outgoing ? "You" : "Peer"}</span>
          <div class="message-content">${escapeHtml(msg.message)}</div>
          <span class="chat-time">${formatDate(msg.timestamp)}</span>
        </div>
      `;
    })
    .join("");

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getAllMessagesFromLocalStorage() {
  return JSON.parse(localStorage.getItem("blockchainMessages") || "[]").map(
    (msg) => normalizeMessage(msg),
  );
}

function sendMessageLocally(sender, recipient, message) {
  const allMessages = getAllMessagesFromLocalStorage();
  const newMessage = {
    sender,
    recipient,
    message,
    timestamp: Math.floor(Date.now() / 1000),
  };
  allMessages.push(newMessage);
  localStorage.setItem("blockchainMessages", JSON.stringify(allMessages));
  return Promise.resolve();
}

function showNotification(message, type = "info") {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = "block";

  setTimeout(() => {
    notification.style.display = "none";
  }, 5000);
}

function formatDate(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
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

async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
    return;
  }

  if (!compareAddress(accounts[0], currentAccount)) {
    currentAccount = accounts[0];
    updateWalletUI();
    await refreshMessagesUI();
    showNotification(`Switched to ${shortAddress(accounts[0])}`, "info");
  }
}

function handleChainChanged() {
  window.location.reload();
}
