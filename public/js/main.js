document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages');
    const onlineUsersList = document.getElementById('online-users');
    const themeToggle = document.getElementById('theme-toggle');
    const searchInput = document.getElementById('search-input');
    const currentUser = JSON.parse(document.getElementById('user-data').textContent);
    let isEncrypted = false;
    
    // Join chat
    socket.emit('join', currentUser._id);
    
    // Theme toggle
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark-mode');
        document.cookie = `darkMode=${isDark}; path=/; max-age=${60 * 60 * 24 * 365}`;
        themeToggle.innerHTML = `<i class="fas fa-${isDark ? 'sun' : 'moon'}"></i>`;
    });
    
    // Encryption toggle
    document.getElementById('encrypt-toggle').addEventListener('change', (e) => {
        isEncrypted = e.target.checked;
    });
    
    // Typing indicator
    messageInput.addEventListener('input', () => {
        socket.emit('typing');
    });
    
    // Message form submission
    messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = messageInput.value.trim();
        
        if (message) {
            socket.emit('chatMessage', {
                text: message,
                isEncrypted: isEncrypted
            });
            messageInput.value = '';
        }
    });
    
    // Handle incoming messages
    socket.on('newMessage', (msg) => {
        appendMessage(msg);
        
        // Mark as read if it's our chat
        if (msg.username !== currentUser.username) {
            socket.emit('messageRead', msg._id);
        }
    });
    
    // Handle message updates
    socket.on('messageUpdated', (msg) => {
        const messageElement = document.querySelector(`[data-id="${msg._id}"]`);
        if (messageElement) {
            const textElement = messageElement.querySelector('.text');
            textElement.textContent = msg.isEncrypted ? decryptMessage(msg.text) : msg.text;
            
            if (msg.isEdited) {
                const editBadge = document.createElement('span');
                editBadge.className = 'edit-badge';
                editBadge.textContent = 'edited';
                messageElement.appendChild(editBadge);
            }
        }
    });
    
    // Handle message deletion
    socket.on('messageDeleted', ({ id }) => {
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            messageElement.innerHTML = '<em>Message deleted</em>';
            messageElement.classList.add('deleted-message');
        }
    });
    
    // Handle typing indicators
    socket.on('userTyping', ({ username }) => {
        const typingElement = document.getElementById('typing-indicator');
        if (!typingElement) {
            const indicator = document.createElement('div');
            indicator.id = 'typing-indicator';
            indicator.className = 'typing-indicator';
            indicator.textContent = `${username} is typing...`;
            messagesContainer.appendChild(indicator);
        }
    });
    
    socket.on('userStoppedTyping', ({ username }) => {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement && typingElement.textContent.includes(username)) {
            typingElement.remove();
        }
    });
    
    // Handle online users updates
    socket.on('presenceUpdate', ({ onlineUsers }) => {
        onlineUsersList.innerHTML = onlineUsers
            .filter(user => user._id !== currentUser._id)
            .map(user => `
                <li>
                    <img src="${user.profilePic || '/images/default-avatar.jpg'}" alt="${user.username}" class="profile-pic-small">
                    ${user.username}
                </li>
            `).join('');
    });
    
    // Handle message reactions
    socket.on('messageReaction', ({ id, reactions }) => {
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            let reactionsContainer = messageElement.querySelector('.reactions');
            
            if (!reactionsContainer) {
                reactionsContainer = document.createElement('div');
                reactionsContainer.className = 'reactions';
                messageElement.appendChild(reactionsContainer);
            }
            
            reactionsContainer.innerHTML = reactions
                .map(r => `<span class="reaction" title="${r.username}">${r.reaction}</span>`)
                .join('');
        }
    });
    
    // Handle message status updates
    socket.on('messageStatusUpdate', ({ id, status }) => {
        const messageElement = document.querySelector(`[data-id="${id}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.status');
            if (statusElement) {
                statusElement.textContent = status;
            }
        }
    });
    
    // Append message to DOM
    function appendMessage(msg) {
        const isCurrentUser = msg.username === currentUser.username;
        const isSystem = msg.username === 'System';
        const isMedia = msg.mediaUrl;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${isCurrentUser ? 'current-user' : ''} ${isSystem ? 'system-message' : ''}`;
        messageElement.dataset.id = msg._id;
        
        if (isSystem) {
            messageElement.textContent = msg.text;
        } else if (isMedia) {
            messageElement.classList.add('media-message');
            
            let mediaElement;
            if (msg.mediaType === 'image') {
                mediaElement = document.createElement('img');
                mediaElement.src = msg.mediaUrl;
                mediaElement.alt = 'Image';
            } else if (msg.mediaType === 'video') {
                mediaElement = document.createElement('video');
                mediaElement.src = msg.mediaUrl;
                mediaElement.controls = true;
            } else {
                mediaElement = document.createElement('a');
                mediaElement.href = msg.mediaUrl;
                mediaElement.textContent = 'Download file';
                mediaElement.target = '_blank';
            }
            
            messageElement.innerHTML = `
                <span class="username">${msg.username}</span>
                <div class="media-container"></div>
                <div class="media-caption">${msg.text.replace(`[${msg.mediaType.toUpperCase()}] `, '')}</div>
                <span class="timestamp">${formatDate(msg.timestamp)}</span>
            `;
            
            messageElement.querySelector('.media-container').appendChild(mediaElement);
        } else {
            const messageText = msg.isEncrypted ? decryptMessage(msg.text) : msg.text;
            
            messageElement.innerHTML = `
                <span class="username">${msg.username}</span>
                <p class="text">${messageText}</p>
                ${msg.isEdited ? '<span class="edit-badge">edited</span>' : ''}
                <span class="timestamp">${formatDate(msg.timestamp)}</span>
                ${msg.reactions?.length ? `
                    <div class="reactions">
                        ${msg.reactions.map(r => `<span class="reaction" title="${r.username}">${r.reaction}</span>`).join('')}
                    </div>
                ` : ''}
            `;
        }
        
        // Add message actions for current user's messages
        if (isCurrentUser && !isSystem) {
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.innerHTML = `
                <button class="edit-btn" title="Edit"><i class="fas fa-edit"></i></button>
                <button class="delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
                <button class="react-btn" title="React"><i class="fas fa-smile"></i></button>
            `;
            
            messageElement.appendChild(actions);
            
            // Add event listeners for actions
            actions.querySelector('.edit-btn').addEventListener('click', () => editMessage(msg._id, messageElement.querySelector('.text').textContent));
            actions.querySelector('.delete-btn').addEventListener('click', () => deleteMessage(msg._id));
            actions.querySelector('.react-btn').addEventListener('click', (e) => showReactionPicker(msg._id, e));
        } else if (!isSystem) {
            // Add reaction option for other users' messages
            messageElement.addEventListener('dblclick', () => {
                showReactionPicker(msg._id);
            });
        }
        
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Format date
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Edit message
    function editMessage(id, currentText) {
        const newText = prompt('Edit your message:', currentText);
        if (newText && newText !== currentText) {
            fetch(`/messages/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: newText })
            }).catch(err => console.error('Error editing message:', err));
        }
    }
    
    // Delete message
    function deleteMessage(id) {
        if (confirm('Are you sure you want to delete this message?')) {
            fetch(`/messages/${id}`, {
                method: 'DELETE'
            }).catch(err => console.error('Error deleting message:', err));
        }
    }
    
    // Show reaction picker
    function showReactionPicker(messageId, event) {
        // Close any open reaction pickers
        document.querySelectorAll('.reaction-picker').forEach(picker => {
            picker.classList.remove('show');
        });
        
        const picker = document.createElement('div');
        picker.className = 'reaction-picker show';
        picker.innerHTML = `
            <span>👍</span>
            <span>❤️</span>
            <span>😂</span>
            <span>😮</span>
            <span>😢</span>
            <span>😠</span>
        `;
        
        if (event) {
            picker.style.bottom = `${window.innerHeight - event.clientY}px`;
            picker.style.right = `${window.innerWidth - event.clientX}px`;
        } else {
            picker.style.bottom = '80px';
            picker.style.right = '20px';
        }
        
        document.body.appendChild(picker);
        
        // Handle reaction selection
        picker.querySelectorAll('span').forEach(span => {
            span.addEventListener('click', () => {
                socket.emit('reactToMessage', {
                    messageId,
                    reaction: span.textContent
                });
                picker.remove();
            });
        });
        
        // Close picker when clicking outside
        const clickHandler = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', clickHandler);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', clickHandler);
        }, 100);
    }
    
    // Search functionality
    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim();
        if (query.length >= 3) {
            fetch(`/search?q=${encodeURIComponent(query)}`)
                .then(res => res.json())
                .then(data => {
                    // Display search results
                    console.log('Search results:', data.results);
                });
        }
    }, 300));
    
    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
});
                                  
