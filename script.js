import { auth, db } from './firebase-config.js';
import { 
    signOut, onAuthStateChanged, updateProfile, deleteUser,
    signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    collection, query, where, getDocs, addDoc, orderBy, onSnapshot, 
    doc, updateDoc, getDoc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentUser = null;
let selectedFriend = null;
let currentChatId = null;
let messagesUnsubscribe = null;
let typingTimeout = null;
let notificationPermission = false;
let searchTimeout = null;
let allUsersCache = [];

const authContainer = document.getElementById('authContainer');
const chatContainer = document.getElementById('chatContainer');
const welcomeSection = document.getElementById('welcomeSection');
const chatsPanel = document.getElementById('chatsPanel');
const findFriendsPanel = document.getElementById('findFriendsPanel');
const requestsPanel = document.getElementById('requestsPanel');
const profilePanel = document.getElementById('profilePanel');
const notificationPanel = document.getElementById('notificationPanel');
const chatArea = document.getElementById('chatArea');
const friendsListDiv = document.getElementById('friendsList');
const allUsersListDiv = document.getElementById('allUsersList');
const requestsListDiv = document.getElementById('requestsList');
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendMessageBtn');
const chatAreaHeader = document.getElementById('chatAreaHeader');
const requestBadge = document.getElementById('requestBadge');
const typingIndicator = document.getElementById('typingIndicator');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const searchUserInput = document.getElementById('searchUserInput');

const chatsTab = document.getElementById('chatsTab');
const findFriendsTab = document.getElementById('findFriendsTab');
const requestsTab = document.getElementById('requestsTab');
const profileSettingsBtn = document.getElementById('profileSettingsBtn');
const notificationSettingsBtn = document.getElementById('notificationSettingsBtn');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutNavBtn = document.getElementById('logoutNavBtn');

const avatarPlaceholder = document.getElementById('avatarPlaceholder');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileBio = document.getElementById('profileBio');
const updateProfileBtn = document.getElementById('updateProfileBtn');
const changeBioBtn = document.getElementById('changeBioBtn');

function showToast(title, message, type = 'info') {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || 'ℹ️'}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <div class="toast-close">&times;</div>
    `;
    
    toastContainer.appendChild(toast);
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));
    
    setTimeout(() => removeToast(toast), 5000);
    toast.addEventListener('click', () => removeToast(toast));
}

function removeToast(toast) {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
}

showSignup?.addEventListener('click', () => {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showLogin?.addEventListener('click', () => {
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

loginBtn?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        showToast('Missing Info', 'Please fill all fields', 'warning');
        return;
    }
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Welcome Back!', 'Login successful!', 'success');
    } catch (error) {
        showToast('Login Failed', error.message, 'error');
    }
});

signupBtn?.addEventListener('click', async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    if (!name || !email || !password) {
        showToast('Missing Info', 'Please fill all fields', 'warning');
        return;
    }
    if (password.length < 6) {
        showToast('Password Error', 'Password must be at least 6 characters', 'warning');
        return;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            name: name,
            email: email,
            uid: userCredential.user.uid,
            bio: '',
            online: true,
            lastSeen: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });
        showToast('Welcome to HemalChat!', 'Account created successfully! Please login.', 'success');
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        document.getElementById('signupName').value = '';
        document.getElementById('signupEmail').value = '';
        document.getElementById('signupPassword').value = '';
    } catch (error) {
        showToast('Signup Failed', error.message, 'error');
    }
});

logoutNavBtn?.addEventListener('click', async () => {
    if (currentUser) {
        await updateDoc(doc(db, 'users', currentUser.uid), { online: false, lastSeen: new Date().toISOString() });
    }
    await signOut(auth);
    showToast('Logged Out', 'You have been logged out', 'info');
    window.location.reload();
});

async function updateUserStatus(isOnline) {
    if (!currentUser) return;
    await updateDoc(doc(db, 'users', currentUser.uid), {
        online: isOnline,
        lastSeen: new Date().toISOString()
    });
}

window.addEventListener('beforeunload', () => {
    if (currentUser) {
        updateUserStatus(false);
    }
});

async function requestNotificationPermission() {
    if (!("Notification" in window)) {
        showToast('Not Supported', 'This browser does not support notifications', 'warning');
        return false;
    }
    
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        notificationPermission = true;
        showToast('Notifications Enabled', 'You will receive alerts for new messages', 'success');
        return true;
    } else {
        showToast('Permission Denied', 'Notification permission denied', 'error');
        return false;
    }
}

function showNotification(title, body) {
    if (!notificationPermission) return;
    if (document.hasFocus()) return;
    
    const options = {
        body: body,
        icon: "https://ui-avatars.com/api/?background=00ffff&color=fff&bold=true",
        silent: false,
        vibrate: [200, 100, 200]
    };
    
    const notification = new Notification(title, options);
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
    setTimeout(() => notification.close(), 5000);
}

enableNotificationsBtn?.addEventListener('click', requestNotificationPermission);

function filterUsers(searchTerm) {
    if (!allUsersCache.length) return;
    const term = searchTerm.toLowerCase().trim();
    if (!term) {
        displayUsersList(allUsersCache);
        return;
    }
    const filtered = allUsersCache.filter(user => 
        user.name.toLowerCase().includes(term) || 
        user.email.toLowerCase().includes(term)
    );
    displayUsersList(filtered);
    if (filtered.length === 0) {
        showToast('No Results', 'No users found with that name or email', 'info');
    }
}

function displayUsersList(users) {
    if (users.length === 0) {
        allUsersListDiv.innerHTML = '<div class="loading-users">No users found</div>';
        return;
    }
    allUsersListDiv.innerHTML = '';
    for (const user of users) {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `
            <div class="user-avatar">
                <span>${user.name.charAt(0).toUpperCase()}</span>
                <span class="${user.online ? 'online-dot' : 'offline-dot'}"></span>
            </div>
            <div class="user-info">
                <div class="user-name">${escapeHtml(user.name)}</div>
                <div class="user-email">${escapeHtml(user.email)}</div>
                ${user.bio ? `<div class="user-bio">${escapeHtml(user.bio.substring(0, 40))}</div>` : ''}
            </div>
            <button class="add-friend-btn" data-uid="${user.uid}" data-name="${user.name}">Add Friend</button>
        `;
        const addBtn = div.querySelector('.add-friend-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sendFriendRequest(user.uid, user.name);
        });
        allUsersListDiv.appendChild(div);
    }
}

if (searchUserInput) {
    searchUserInput.addEventListener('input', (e) => {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => filterUsers(e.target.value), 300);
    });
}

async function deleteAccount() {
    const warning = "⚠️ WARNING: This will permanently delete:\n\n- Your account\n- All your messages\n- Your friend list\n- All friend requests\n\nThis CANNOT be undone!\n\nType 'DELETE' to confirm:";
    const confirmation = prompt(warning);
    if (confirmation !== "DELETE") {
        showToast('Cancelled', 'Account deletion cancelled', 'info');
        return;
    }
    if (!confirm("Are you ABSOLUTELY sure?")) return;
    
    showToast('Processing', 'Deleting your account...', 'info');
    
    try {
        const sentRequests = await getDocs(query(collection(db, 'friend_requests'), where('senderId', '==', currentUser.uid)));
        for (const docSnap of sentRequests.docs) {
            await deleteDoc(doc(db, 'friend_requests', docSnap.id));
        }
        const receivedRequests = await getDocs(query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid)));
        for (const docSnap of receivedRequests.docs) {
            await deleteDoc(doc(db, 'friend_requests', docSnap.id));
        }
        const friendships = await getDocs(query(collection(db, 'friends'), where('userId', '==', currentUser.uid)));
        for (const docSnap of friendships.docs) {
            const friendId = docSnap.data().friendId;
            await deleteDoc(doc(db, 'friends', currentUser.uid + '_' + friendId));
            await deleteDoc(doc(db, 'friends', friendId + '_' + currentUser.uid));
        }
        const chatsRef = collection(db, 'chats');
        const allChats = await getDocs(chatsRef);
        for (const chatDoc of allChats.docs) {
            if (chatDoc.id.includes(currentUser.uid)) {
                const messagesRef = collection(db, 'chats', chatDoc.id, 'messages');
                const messages = await getDocs(messagesRef);
                for (const msgDoc of messages.docs) {
                    await deleteDoc(doc(db, 'chats', chatDoc.id, 'messages', msgDoc.id));
                }
                await deleteDoc(doc(db, 'chats', chatDoc.id));
            }
        }
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        showToast('Account Deleted', 'Your account has been permanently deleted', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        console.error("Delete error:", error);
        showToast('Delete Failed', 'Please re-authenticate and try again', 'error');
    }
}

deleteAccountBtn?.addEventListener('click', deleteAccount);

async function markAsDelivered(chatId, messageIds) {
    for (const messageId of messageIds) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { delivered: true });
    }
}

async function markAsSeen(chatId, messageIds) {
    for (const messageId of messageIds) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { seen: true });
    }
}

async function sendTypingStatus() {
    if (!currentUser || !selectedFriend || !currentChatId) return;
    const typingRef = doc(db, 'typing', currentChatId);
    await setDoc(typingRef, { userId: currentUser.uid, isTyping: true, timestamp: new Date().toISOString() });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(async () => {
        await setDoc(typingRef, { userId: currentUser.uid, isTyping: false, timestamp: new Date().toISOString() });
    }, 1500);
}

function listenTypingStatus() {
    if (!currentUser || !selectedFriend || !currentChatId) return;
    const typingRef = doc(db, 'typing', currentChatId);
    onSnapshot(typingRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().userId !== currentUser.uid && docSnap.data().isTyping) {
            typingIndicator.style.display = 'block';
            setTimeout(() => { typingIndicator.style.display = 'none'; }, 2000);
        }
    });
}

async function deleteMessage(chatId, messageId) {
    if (confirm('Delete this message?')) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { text: 'This message was deleted', deleted: true });
        showToast('Message Deleted', 'Message has been deleted', 'info');
    }
}

async function editMessage(chatId, messageId, oldText) {
    const newText = prompt('Edit message:', oldText);
    if (newText && newText.trim() && newText.trim() !== oldText) {
        await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), { text: newText.trim(), edited: true });
        showToast('Message Edited', 'Message has been updated', 'success');
    }
}

async function sendFriendRequest(receiverId, receiverName) {
    if (!currentUser) return;
    const q = query(collection(db, 'friend_requests'), where('senderId', '==', currentUser.uid), where('receiverId', '==', receiverId), where('status', '==', 'pending'));
    const existing = await getDocs(q);
    if (!existing.empty) {
        showToast('Request Already Sent', 'Friend request already sent to this user', 'warning');
        return;
    }
    await addDoc(collection(db, 'friend_requests'), {
        senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
        receiverId: receiverId, receiverName: receiverName, status: 'pending', timestamp: new Date().toISOString()
    });
    showToast('Request Sent', `Friend request sent to ${receiverName}`, 'success');
}

async function acceptRequest(requestId, senderId, senderName) {
    try {
        const requestRef = doc(db, 'friend_requests', requestId);
        const requestSnap = await getDoc(requestRef);
        
        if (!requestSnap.exists()) {
            showToast('Error', 'Friend request not found', 'error');
            return;
        }
        
        if (requestSnap.data().status !== 'pending') {
            showToast('Info', 'This request has already been processed', 'info');
            return;
        }
        
        await updateDoc(requestRef, { status: 'accepted' });
        
        const chatId = currentUser.uid < senderId ? currentUser.uid + '_' + senderId : senderId + '_' + currentUser.uid;
        
        const friendDoc1 = doc(db, 'friends', currentUser.uid + '_' + senderId);
        const friendDoc2 = doc(db, 'friends', senderId + '_' + currentUser.uid);
        
        const [snap1, snap2] = await Promise.all([getDoc(friendDoc1), getDoc(friendDoc2)]);
        
        if (!snap1.exists()) {
            await setDoc(friendDoc1, {
                userId: currentUser.uid,
                friendId: senderId,
                chatId: chatId,
                createdAt: new Date().toISOString()
            });
        }
        
        if (!snap2.exists()) {
            await setDoc(friendDoc2, {
                userId: senderId,
                friendId: currentUser.uid,
                chatId: chatId,
                createdAt: new Date().toISOString()
            });
        }
        
        await loadPendingRequestsCount();
        await loadFriendsList();
        
        showToast('Friend Added', `You are now friends with ${senderName} 🎉`, 'success');
        
    } catch (error) {
        console.error('Accept request error:', error);
        showToast('Error', 'Failed to accept friend request', 'error');
    }
}

async function rejectRequest(requestId) {
    await updateDoc(doc(db, 'friend_requests', requestId), { status: 'rejected' });
    loadPendingRequestsCount();
    loadPendingRequests();
    showToast('Request Rejected', 'Friend request rejected', 'info');
}

async function unfriendUser(friendId, friendName) {
    if (confirm(`Remove ${friendName} from friends?`)) {
        await deleteDoc(doc(db, 'friends', currentUser.uid + '_' + friendId));
        await deleteDoc(doc(db, 'friends', friendId + '_' + currentUser.uid));
        loadFriendsList();
        if (selectedFriend?.uid === friendId) closeChat();
        showToast('Friend Removed', `${friendName} has been removed from your friends`, 'info');
    }
}

async function loadPendingRequestsCount() {
    if (!currentUser) return;
    const q = query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    const count = snapshot.size;
    if (count > 0) {
        requestBadge.classList.remove('hidden');
        requestBadge.textContent = count;
    } else {
        requestBadge.classList.add('hidden');
    }
}

async function loadPendingRequests() {
    if (!currentUser) return;
    requestsListDiv.innerHTML = '<div class="loading-users"><i class="fas fa-spinner fa-spin"></i> Loading requests...</div>';
    const q = query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        requestsListDiv.innerHTML = '<div class="loading-users">No pending requests</div>';
        return;
    }
    requestsListDiv.innerHTML = '';
    snapshot.forEach(docSnap => {
        const req = docSnap.data();
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `<span><strong>${escapeHtml(req.senderName)}</strong> sent you a friend request</span><div><button class="accept-btn" data-id="${docSnap.id}" data-sender="${req.senderId}" data-name="${req.senderName}">Accept</button><button class="reject-btn" data-id="${docSnap.id}">Reject</button></div>`;
        requestsListDiv.appendChild(div);
    });
    document.querySelectorAll('.accept-btn').forEach(btn => btn.addEventListener('click', () => acceptRequest(btn.dataset.id, btn.dataset.sender, btn.dataset.name)));
    document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => rejectRequest(btn.dataset.id)));
}

async function loadFriendsList() {
    if (!currentUser) return;
    friendsListDiv.innerHTML = '<div class="loading-users"><i class="fas fa-spinner fa-spin"></i> Loading friends...</div>';
    
    const q = query(collection(db, 'friends'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        friendsListDiv.innerHTML = '<div class="loading-users">No friends yet. Add some!</div>';
        return;
    }
    
    const uniqueFriends = new Map();
    
    for (const docSnap of snapshot.docs) {
        const friendId = docSnap.data().friendId;
        if (!uniqueFriends.has(friendId)) {
            const userDoc = await getDoc(doc(db, 'users', friendId));
            if (userDoc.exists()) {
                uniqueFriends.set(friendId, { uid: friendId, ...userDoc.data() });
            }
        }
    }
    
    const friends = Array.from(uniqueFriends.values());
    
    if (friends.length === 0) {
        friendsListDiv.innerHTML = '<div class="loading-users">No friends found</div>';
        return;
    }
    
    friendsListDiv.innerHTML = '';
    for (const friend of friends) {
        const isOnline = friend.online || false;
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<div class="user-avatar"><span>${friend.name.charAt(0).toUpperCase()}</span><span class="${isOnline ? 'online-dot' : 'offline-dot'}"></span></div><div class="user-info"><div class="user-name">${escapeHtml(friend.name)}</div><div class="user-email">${escapeHtml(friend.email)}</div>${friend.bio ? `<div class="user-bio">${escapeHtml(friend.bio.substring(0, 40))}</div>` : ''}</div><button class="add-friend-btn unfriend-btn" data-uid="${friend.uid}" data-name="${friend.name}">Unfriend</button>`;
        const unfriendBtn = div.querySelector('.unfriend-btn');
        unfriendBtn.addEventListener('click', (e) => { e.stopPropagation(); unfriendUser(friend.uid, friend.name); });
        div.addEventListener('click', () => openChat(friend));
        friendsListDiv.appendChild(div);
    }
}

async function loadAllUsers() {
    if (!currentUser) return;
    allUsersListDiv.innerHTML = '<div class="loading-users"><i class="fas fa-spinner fa-spin"></i> Loading users...</div>';
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const friendsSnapshot = await getDocs(query(collection(db, 'friends'), where('userId', '==', currentUser.uid)));
    const friendIds = new Set();
    friendsSnapshot.forEach(docSnap => friendIds.add(docSnap.data().friendId));
    const users = [];
    for (const docSnap of snapshot.docs) {
        if (docSnap.id !== currentUser.uid && !friendIds.has(docSnap.id)) {
            users.push({ uid: docSnap.id, ...docSnap.data() });
        }
    }
    allUsersCache = users;
    if (users.length === 0) {
        allUsersListDiv.innerHTML = '<div class="loading-users">No new users to add</div>';
        return;
    }
    displayUsersList(users);
}

async function loadProfile() {
    if (!currentUser) return;
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = userDoc.data();
    if (avatarPlaceholder) avatarPlaceholder.textContent = (userData.name || currentUser.email).charAt(0).toUpperCase();
    profileName.value = userData.name || '';
    profileEmail.value = userData.email || '';
    profileBio.value = userData.bio || '';
}

updateProfileBtn?.addEventListener('click', async () => {
    const newName = profileName.value.trim();
    const newBio = profileBio.value.trim();
    if (newName) {
        await updateProfile(auth.currentUser, { displayName: newName });
        await updateDoc(doc(db, 'users', currentUser.uid), { name: newName, bio: newBio });
        showToast('Profile Updated', 'Your profile has been updated successfully', 'success');
        if (avatarPlaceholder) avatarPlaceholder.textContent = newName.charAt(0).toUpperCase();
        loadFriendsList();
        loadAllUsers();
    }
});

changeBioBtn?.addEventListener('click', () => profileBio.focus());

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function sendMessage() {
    if (!currentUser || !selectedFriend) {
        showToast('No Chat Selected', 'Please select a friend to chat with', 'warning');
        return;
    }
    const text = messageInput?.value.trim();
    if (!text) return;
    const chatId = currentUser.uid < selectedFriend.uid ? currentUser.uid + '_' + selectedFriend.uid : selectedFriend.uid + '_' + currentUser.uid;
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    try {
        await addDoc(messagesRef, {
            text: text, senderId: currentUser.uid, receiverId: selectedFriend.uid,
            timestamp: new Date().toISOString(), sent: true, delivered: false, read: false, seen: false, edited: false, deleted: false
        });
        messageInput.value = '';
        messageInput.focus();
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Send Failed', 'Failed to send message', 'error');
    }
}

async function openChat(friend) {
    if (!currentUser) return;
    selectedFriend = friend;
    currentChatId = currentUser.uid < friend.uid ? currentUser.uid + '_' + friend.uid : friend.uid + '_' + currentUser.uid;
    chatArea.classList.remove('hidden');
    welcomeSection.classList.add('hidden');
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    const friendDoc = await getDoc(doc(db, 'users', friend.uid));
    const friendData = friendDoc.data();
    chatAreaHeader.innerHTML = `<div class="selected-user-info"><div class="user-avatar" style="width:40px;height:40px;font-size:1rem;">${friend.name.charAt(0).toUpperCase()}</div><div><strong>${escapeHtml(friend.name)}</strong><div style="font-size:0.7rem;">${friendData?.online ? '🟢 Online' : '⚫ Offline'}</div>${friendData?.bio ? `<div style="font-size:0.65rem;color:#aaa;">${escapeHtml(friendData.bio.substring(0, 50))}</div>` : ''}</div></div>`;
    if (messagesUnsubscribe) messagesUnsubscribe();
    const messagesRef = collection(db, 'chats', currentChatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    const deliveredMessages = [];
    const seenMessages = [];
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            messagesArea.innerHTML = '<div class="no-chat-selected"><i class="fas fa-comments"></i><p>No messages yet. Send a message!</p></div>';
            return;
        }
        messagesArea.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const isOwn = msg.senderId === currentUser.uid;
            const isDeleted = msg.deleted === true;
            if (!isOwn && !msg.delivered) deliveredMessages.push(docSnap.id);
            if (!isOwn && msg.delivered && !msg.seen) seenMessages.push(docSnap.id);
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
            let timeStr = '';
            if (msg.timestamp) {
                const date = new Date(msg.timestamp);
                timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            let contentHtml = '';
            if (isDeleted) {
                contentHtml = `<div class="message-text" style="font-style:italic;opacity:0.6;">${escapeHtml(msg.text)}</div>`;
            } else {
                contentHtml = `<div class="message-text">${escapeHtml(msg.text)}</div>`;
            }
            
            let readStatusHtml = '';
            if (isOwn) {
                if (msg.seen) {
                    readStatusHtml = `<span class="read-status" style="color: #000; font-size: 1.1rem; font-weight: bold;">●</span>`;
                } else if (msg.delivered) {
                    readStatusHtml = `<span class="read-status" style="color: #00ffff;">✓✓</span>`;
                } else if (msg.sent) {
                    readStatusHtml = `<span class="read-status" style="color: #aaa;">✓</span>`;
                }
            }
            
            messageDiv.innerHTML = `<div class="message-bubble">${contentHtml}<div class="message-time">${timeStr} ${readStatusHtml}${isOwn && !isDeleted ? `<div class="message-menu"><button class="message-menu-btn edit-msg" data-id="${docSnap.id}" data-text="${escapeHtml(msg.text)}"><i class="fas fa-edit"></i></button><button class="message-menu-btn delete-msg" data-id="${docSnap.id}"><i class="fas fa-trash"></i></button></div>` : ''}${msg.edited && !isDeleted ? '<span style="font-size:0.6rem;">(edited)</span>' : ''}</div></div>`;
            messagesArea.appendChild(messageDiv);
            if (!isOwn && !document.hasFocus()) {
                showNotification(`New message from ${friend.name}`, msg.text.substring(0, 100));
            }
        });
        messagesArea.scrollTop = messagesArea.scrollHeight;
        if (deliveredMessages.length > 0) markAsDelivered(currentChatId, deliveredMessages);
        if (seenMessages.length > 0) markAsSeen(currentChatId, seenMessages);
        document.querySelectorAll('.edit-msg').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); editMessage(currentChatId, btn.dataset.id, btn.dataset.text); }));
        document.querySelectorAll('.delete-msg').forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); deleteMessage(currentChatId, btn.dataset.id); }));
    });
    listenTypingStatus();
}

function closeChat() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    selectedFriend = null;
    currentChatId = null;
    chatArea.classList.add('hidden');
    welcomeSection.classList.remove('hidden');
}

sendBtn?.addEventListener('click', sendMessage);
messageInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); else sendTypingStatus(); });

emojiBtn?.addEventListener('click', (e) => { e.stopPropagation(); emojiPicker.classList.toggle('hidden'); });
document.querySelectorAll('.emoji').forEach(emoji => {
    emoji.addEventListener('click', () => { messageInput.value += emoji.textContent; emojiPicker.classList.add('hidden'); messageInput.focus(); });
});
document.addEventListener('click', (e) => { if (!emojiPicker?.contains(e.target) && !emojiBtn?.contains(e.target)) emojiPicker?.classList.add('hidden'); });

chatsTab?.addEventListener('click', () => {
    welcomeSection.classList.add('hidden'); chatArea.classList.add('hidden'); chatsPanel.classList.remove('hidden');
    findFriendsPanel.classList.add('hidden'); requestsPanel.classList.add('hidden'); profilePanel.classList.add('hidden'); notificationPanel.classList.add('hidden');
    loadFriendsList();
});
findFriendsTab?.addEventListener('click', () => {
    welcomeSection.classList.add('hidden'); chatArea.classList.add('hidden'); chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.remove('hidden'); requestsPanel.classList.add('hidden'); profilePanel.classList.add('hidden'); notificationPanel.classList.add('hidden');
    loadAllUsers();
});
requestsTab?.addEventListener('click', () => {
    welcomeSection.classList.add('hidden'); chatArea.classList.add('hidden'); chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden'); requestsPanel.classList.remove('hidden'); profilePanel.classList.add('hidden'); notificationPanel.classList.add('hidden');
    loadPendingRequests();
});
profileSettingsBtn?.addEventListener('click', () => {
    welcomeSection.classList.add('hidden'); chatArea.classList.add('hidden'); chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden'); requestsPanel.classList.add('hidden'); profilePanel.classList.remove('hidden'); notificationPanel.classList.add('hidden');
    loadProfile();
});
notificationSettingsBtn?.addEventListener('click', () => {
    welcomeSection.classList.add('hidden'); chatArea.classList.add('hidden'); chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden'); requestsPanel.classList.add('hidden'); profilePanel.classList.add('hidden'); notificationPanel.classList.remove('hidden');
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        authContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            await setDoc(userRef, { name: user.displayName || user.email.split('@')[0], email: user.email, uid: user.uid, bio: '', online: true, lastSeen: new Date().toISOString(), createdAt: new Date().toISOString() });
        } else {
            await updateDoc(userRef, { online: true, lastSeen: new Date().toISOString() });
        }
        loadPendingRequestsCount();
        loadFriendsList();
        if (chatsTab) chatsTab.click();
        showToast('Welcome Back!', `Hello ${user.displayName || user.email.split('@')[0]}`, 'success');
    } else {
        if (currentUser) await updateDoc(doc(db, 'users', currentUser.uid), { online: false });
        currentUser = null; selectedFriend = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
        authContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
    }
});

const dropdownBtn = document.querySelector('.dropdown-btn');
const dropdown = document.querySelector('.dropdown');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navMenu = document.querySelector('.nav-menu');
if (dropdownBtn) dropdownBtn.addEventListener('click', (e) => { e.preventDefault(); dropdown.classList.toggle('active'); });
document.addEventListener('click', (e) => { if (dropdown && !dropdown.contains(e.target)) dropdown.classList.remove('active'); });
if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', () => navMenu.classList.toggle('active'));

let isDarkMode = true;
const themeToggleNav = document.getElementById('themeToggleNav');
if (themeToggleNav) {
    themeToggleNav.addEventListener('click', (e) => {
        e.preventDefault();
        if (isDarkMode) {
            document.body.classList.add('light-mode');
            themeToggleNav.innerHTML = '<i class="fas fa-sun"></i> Light/Dark Mode';
            isDarkMode = false;
            showToast('Theme Changed', 'Light mode activated', 'info');
        } else {
            document.body.classList.remove('light-mode');
            themeToggleNav.innerHTML = '<i class="fas fa-moon"></i> Dark/Light Mode';
            isDarkMode = true;
            showToast('Theme Changed', 'Dark mode activated', 'info');
        }
        if (dropdown) dropdown.classList.remove('active');
    });
}

async function cleanDuplicateFriends() {
    const q = query(collection(db, 'friends'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);

    const unique = new Map();

    for (const docSnap of snapshot.docs) {
        const friendId = docSnap.data().friendId;
        if (unique.has(friendId)) {
            await deleteDoc(doc(db, 'friends', docSnap.id));
            console.log(`Deleted duplicate: ${friendId}`);
        } else {
            unique.set(friendId, docSnap.id);
        }
    }

    await loadFriendsList();
    showToast('Cleaned', 'Duplicate friends removed', 'success');
}

window.cleanDuplicateFriends = cleanDuplicateFriends;

console.log("========================================");
console.log("HemalChatApp - Fully Fixed! No duplicate friends on reload");
console.log("✅ Toast notifications | ✅ Read Status: ✓ → ✓✓ → ●");
console.log("✅ Search Users | ✅ Delete Account | ✅ Notifications");
console.log("✅ Typing Indicator | ✅ Online Status | ✅ Edit/Delete Message");
console.log("Created by Hemal Das");
console.log("========================================");