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

    // 
    event MessageSent(
        address indexed sender,
        address indexed recipient,
        string messageText,
        uint256 timestamp
    );

    // Storage
    Message[] public allMessages;
    mapping(address => uint256[]) public userInboxIndices;
        mapping(address => uint256[]) public userSentIndices;

    // Send message
    function sendMessage(address _recipient, string calldata _messageText) public {
        require(_recipient != address(0), "Invalid recipient address");
        require(bytes(_messageText).length > 0, "Message cannot be empty");
        require(bytes(_messageText).length <= 500, "Message too long");

        Message memory newMessage = Message({
            sender: msg.sender,
            recipient: _recipient,
            messageText: _messageText,
            timestamp: block.timestamp
        });

        allMessages.push(newMessage);
        userInboxIndices[_recipient].push(allMessages.length - 1);
            userSentIndices[msg.sender].push(allMessages.length - 1);

        emit MessageSent(msg.sender, _recipient, _messageText, block.timestamp);
    }

    // Get received messages
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
    
        // Get sent messages
        function getSentMessages(address _user)
            public
            view
            returns (Message[] memory)
        {
            uint256[] storage indices = userSentIndices[_user];
            Message[] memory userMessages = new Message[](indices.length);

            for (uint256 i = 0; i < indices.length; i++) {
                userMessages[i] = allMessages[indices[i]];
            }

            return userMessages;
        }

    function getMessageCount(address _user) public view returns (uint256) {
        return userInboxIndices[_user].length;
    }

    function getMessage(address _user, uint256 _index)
        public
        view
        returns (Message memory)
    {
        require(_index < userInboxIndices[_user].length, "Out of bounds");
        uint256 messageIndex = userInboxIndices[_user][_index];
        return allMessages[messageIndex];
    }

    function getTotalMessageCount() public view returns (uint256) {
        return allMessages.length;
    }
}