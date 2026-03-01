// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title BlockchainMessenger
 * @dev Simple messaging contract on Base L2 Network
 */
contract BlockchainMessenger {
    
    // Message structure
    struct Message {
        address sender;
        address recipient;
        string messageText;
        uint256 timestamp;
    }

    // Events
    event MessageSent(
        indexed address sender,
        indexed address recipient,
        string messageText,
        uint256 timestamp
    );

    // Storage
    Message[] public allMessages;
    mapping(address => uint256[]) public userInboxIndices;

    /**
     * @dev Send a message to another address
     * @param _recipient The address of the message recipient
     * @param _messageText The content of the message
     */
    function sendMessage(address _recipient, string calldata _messageText) public {
        require(_recipient != address(0), "Invalid recipient address");
        require(bytes(_messageText).length > 0, "Message cannot be empty");
        require(bytes(_messageText).length <= 500, "Message too long (max 500 chars)");

        // Create and store message
        Message memory newMessage = Message({
            sender: msg.sender,
            recipient: _recipient,
            messageText: _messageText,
            timestamp: block.timestamp
        });

        allMessages.push(newMessage);
        userInboxIndices[_recipient].push(allMessages.length - 1);

        emit MessageSent(msg.sender, _recipient, _messageText, block.timestamp);
    }

    /**
     * @dev Get all messages for a specific user
     * @param _user The address of the user
     * @return Array of messages received by the user
     */
    function getReceivedMessages(address _user) 
        public 
        view 
        returns (Message[] memory) 
    {
        uint256[] storage indices = userInboxIndices[_user];
        Message[] memory userMessages = new Message[](indices.length);

        for (uint256 i = 0; i < indices.length; i++) {
            userMessages[i] = allMessages[indices[i]];
        }

        return userMessages;
    }

    /**
     * @dev Get message count for a user
     * @param _user The address of the user
     * @return Number of messages received
     */
    function getMessageCount(address _user) public view returns (uint256) {
        return userInboxIndices[_user].length;
    }

    /**
     * @dev Get a specific message
     * @param _user The recipient address
     * @param _index The index of the message in their inbox
     * @return The message struct
     */
    function getMessage(address _user, uint256 _index) 
        public 
        view 
        returns (Message memory) 
    {
        require(_index < userInboxIndices[_user].length, "Message index out of bounds");
        uint256 messageIndex = userInboxIndices[_user][_index];
        return allMessages[messageIndex];
    }

    /**
     * @dev Get total number of messages in contract
     * @return Total message count
     */
    function getTotalMessageCount() public view returns (uint256) {
        return allMessages.length;
    }
}
