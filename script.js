import { auth, db } from './firebase-config.js';
import { 
    signOut, onAuthStateChanged, updateProfile, deleteUser,
    signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import {
    collection, query, where, getDocs, addDoc, orderBy, onSnapshot, 
    doc, updateDoc, getDoc, setDoc, deleteDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

let currentUser = null;
let selectedFriend = null;
let currentGroup = null;
let currentChatId = null;
let currentChatType = null;
let messagesUnsubscribe = null;
let membersUnsubscribe = null;
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
const groupsPanel = document.getElementById('groupsPanel');
const profilePanel = document.getElementById('profilePanel');
const notificationPanel = document.getElementById('notificationPanel');
const chatArea = document.getElementById('chatArea');
const friendsListDiv = document.getElementById('friendsList');
const allUsersListDiv = document.getElementById('allUsersList');
const requestsListDiv = document.getElementById('requestsList');
const groupsListDiv = document.getElementById('groupsList');
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
const groupsTab = document.getElementById('groupsTab');
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

const createGroupBtn = document.getElementById('createGroupBtn');
const createGroupModal = document.getElementById('createGroupModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const groupNameInput = document.getElementById('groupNameInput');
const groupDescriptionInput = document.getElementById('groupDescriptionInput');
const groupMembersList = document.getElementById('groupMembersList');
const confirmCreateGroupBtn = document.getElementById('confirmCreateGroupBtn');

const groupSettingsModal = document.getElementById('groupSettingsModal');
const closeGroupSettingsModal = document.getElementById('closeGroupSettingsModal');
const editGroupName = document.getElementById('editGroupName');
const editGroupDescription = document.getElementById('editGroupDescription');
const editGroupAvatar = document.getElementById('editGroupAvatar');
const groupMembersManageList = document.getElementById('groupMembersManageList');
const searchFriendToAdd = document.getElementById('searchFriendToAdd');
const friendsToAddList = document.getElementById('friendsToAddList');
const saveGroupSettingsBtn = document.getElementById('saveGroupSettingsBtn');
const deleteGroupBtn = document.getElementById('deleteGroupBtn');

let selectedMembersForGroup = new Set();
let currentGroupForSettings = null;
let allFriendsList = [];

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
    toast.innerHTML = `<div class="toast-icon">${icons[type] || 'ℹ️'}</div><div class="toast-content"><div class="toast-title">${title}</div><div class="toast-message">${message}</div></div><div class="toast-close">&times;</div>`;
    toastContainer.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
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
            name: name, email: email, uid: userCredential.user.uid, bio: '', online: true,
            lastSeen: new Date().toISOString(), createdAt: new Date().toISOString()
        });
        showToast('Success!', 'Account created! Please login.', 'success');
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
    await updateDoc(doc(db, 'users', currentUser.uid), { online: isOnline, lastSeen: new Date().toISOString() });
}

window.addEventListener('beforeunload', () => { if (currentUser) updateUserStatus(false); });

enableNotificationsBtn?.addEventListener('click', async () => {
    if (!("Notification" in window)) return showToast('Not Supported', 'Browser does not support notifications', 'warning');
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        notificationPermission = true;
        showToast('Enabled', 'Notifications enabled!', 'success');
    } else {
        showToast('Denied', 'Notification permission denied', 'error');
    }
});

function showNotification(title, body) {
    if (!notificationPermission || document.hasFocus()) return;
    const notification = new Notification(title, { body: body, icon: "https://ui-avatars.com/api/?background=00ffff&color=fff&bold=true", silent: false, vibrate: [200, 100, 200] });
    notification.onclick = () => { window.focus(); notification.close(); };
    setTimeout(() => notification.close(), 5000);
}

function filterUsers(searchTerm) {
    if (!allUsersCache.length) return;
    const term = searchTerm.toLowerCase().trim();
    displayUsersList(term ? allUsersCache.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term)) : allUsersCache);
}

function displayUsersList(users) {
    if (!users.length) { allUsersListDiv.innerHTML = '<div class="loading-users">No users found</div>'; return; }
    allUsersListDiv.innerHTML = '';
    users.forEach(user => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<div class="user-avatar"><span>${user.name.charAt(0).toUpperCase()}</span><span class="${user.online ? 'online-dot' : 'offline-dot'}"></span></div><div class="user-info"><div class="user-name">${escapeHtml(user.name)}</div><div class="user-email">${escapeHtml(user.email)}</div>${user.bio ? `<div class="user-bio">${escapeHtml(user.bio.substring(0, 40))}</div>` : ''}</div><button class="add-friend-btn" data-uid="${user.uid}" data-name="${user.name}">Add Friend</button>`;
        div.querySelector('.add-friend-btn').addEventListener('click', (e) => { e.stopPropagation(); sendFriendRequest(user.uid, user.name); });
        allUsersListDiv.appendChild(div);
    });
}

searchUserInput?.addEventListener('input', (e) => { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => filterUsers(e.target.value), 300); });

deleteAccountBtn?.addEventListener('click', async () => {
    if (prompt("Type 'DELETE' to confirm:") !== "DELETE") return showToast('Cancelled', 'Account deletion cancelled', 'info');
    if (!confirm("Are you ABSOLUTELY sure?")) return;
    showToast('Processing', 'Deleting your account...', 'info');
    try {
        const sent = await getDocs(query(collection(db, 'friend_requests'), where('senderId', '==', currentUser.uid)));
        for (const d of sent.docs) await deleteDoc(doc(db, 'friend_requests', d.id));
        const rec = await getDocs(query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid)));
        for (const d of rec.docs) await deleteDoc(doc(db, 'friend_requests', d.id));
        const friends = await getDocs(query(collection(db, 'friends'), where('userId', '==', currentUser.uid)));
        for (const d of friends.docs) {
            const fid = d.data().friendId;
            await deleteDoc(doc(db, 'friends', currentUser.uid + '_' + fid));
            await deleteDoc(doc(db, 'friends', fid + '_' + currentUser.uid));
        }
        const groups = await getDocs(query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid)));
        for (const g of groups.docs) {
            await updateDoc(doc(db, 'groups', g.id), { members: arrayRemove(currentUser.uid) });
        }
        const chats = await getDocs(collection(db, 'chats'));
        for (const chat of chats.docs) {
            if (chat.id.includes(currentUser.uid)) {
                const msgs = await getDocs(collection(db, 'chats', chat.id, 'messages'));
                for (const m of msgs.docs) await deleteDoc(doc(db, 'chats', chat.id, 'messages', m.id));
                await deleteDoc(doc(db, 'chats', chat.id));
            }
        }
        await deleteDoc(doc(db, 'users', currentUser.uid));
        await deleteUser(currentUser);
        showToast('Deleted', 'Account permanently deleted', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) { showToast('Failed', 'Please re-authenticate', 'error'); }
});

async function sendFriendRequest(receiverId, receiverName) {
    const q = query(collection(db, 'friend_requests'), where('senderId', '==', currentUser.uid), where('receiverId', '==', receiverId), where('status', '==', 'pending'));
    const existing = await getDocs(q);
    if (!existing.empty) return showToast('Already Sent', 'Request already sent', 'warning');
    await addDoc(collection(db, 'friend_requests'), {
        senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
        receiverId, receiverName, status: 'pending', timestamp: new Date().toISOString()
    });
    showToast('Request Sent', `Friend request sent to ${receiverName}`, 'success');
}

async function acceptRequest(requestId, senderId, senderName) {
    const requestRef = doc(db, 'friend_requests', requestId);
    const snap = await getDoc(requestRef);
    if (!snap.exists() || snap.data().status !== 'pending') return showToast('Error', 'Request not available', 'error');
    await updateDoc(requestRef, { status: 'accepted' });
    const chatId = currentUser.uid < senderId ? currentUser.uid + '_' + senderId : senderId + '_' + currentUser.uid;
    const doc1 = doc(db, 'friends', currentUser.uid + '_' + senderId);
    const doc2 = doc(db, 'friends', senderId + '_' + currentUser.uid);
    if (!(await getDoc(doc1)).exists()) await setDoc(doc1, { userId: currentUser.uid, friendId: senderId, chatId, createdAt: new Date().toISOString() });
    if (!(await getDoc(doc2)).exists()) await setDoc(doc2, { userId: senderId, friendId: currentUser.uid, chatId, createdAt: new Date().toISOString() });
    await loadPendingRequestsCount();
    await loadFriendsList();
    showToast('Friend Added', `You are now friends with ${senderName} 🎉`, 'success');
}

async function rejectRequest(requestId) {
    await updateDoc(doc(db, 'friend_requests', requestId), { status: 'rejected' });
    loadPendingRequestsCount();
    loadPendingRequests();
    showToast('Rejected', 'Friend request rejected', 'info');
}

async function unfriendUser(friendId, friendName) {
    if (confirm(`Remove ${friendName} from friends?`)) {
        await deleteDoc(doc(db, 'friends', currentUser.uid + '_' + friendId));
        await deleteDoc(doc(db, 'friends', friendId + '_' + currentUser.uid));
        if (selectedFriend?.uid === friendId) closeChat();
        loadFriendsList();
        showToast('Removed', `${friendName} removed`, 'info');
    }
}

async function loadPendingRequestsCount() {
    if (!currentUser) return;
    const snap = await getDocs(query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending')));
    const count = snap.size;
    if (count > 0) { requestBadge.classList.remove('hidden'); requestBadge.textContent = count; }
    else { requestBadge.classList.add('hidden'); }
}

async function loadPendingRequests() {
    if (!currentUser) return;
    requestsListDiv.innerHTML = '<div class="loading-users">Loading...</div>';
    const snap = await getDocs(query(collection(db, 'friend_requests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending')));
    if (snap.empty) { requestsListDiv.innerHTML = '<div class="loading-users">No pending requests</div>'; return; }
    requestsListDiv.innerHTML = '';
    snap.forEach(docSnap => {
        const req = docSnap.data();
        const div = document.createElement('div');
        div.className = 'request-item';
        div.innerHTML = `<span><strong>${escapeHtml(req.senderName)}</strong> sent you a request</span><div><button class="accept-btn" data-id="${docSnap.id}" data-sender="${req.senderId}" data-name="${req.senderName}">Accept</button><button class="reject-btn" data-id="${docSnap.id}">Reject</button></div>`;
        requestsListDiv.appendChild(div);
    });
    document.querySelectorAll('.accept-btn').forEach(btn => btn.addEventListener('click', () => acceptRequest(btn.dataset.id, btn.dataset.sender, btn.dataset.name)));
    document.querySelectorAll('.reject-btn').forEach(btn => btn.addEventListener('click', () => rejectRequest(btn.dataset.id)));
}

async function loadFriendsList() {
    if (!currentUser) return;
    friendsListDiv.innerHTML = '<div class="loading-users">Loading...</div>';
    const snap = await getDocs(query(collection(db, 'friends'), where('userId', '==', currentUser.uid)));
    if (snap.empty) { friendsListDiv.innerHTML = '<div class="loading-users">No friends yet</div>'; return; }
    const unique = new Map();
    for (const d of snap.docs) {
        const fid = d.data().friendId;
        if (!unique.has(fid)) {
            const u = await getDoc(doc(db, 'users', fid));
            if (u.exists()) unique.set(fid, { uid: fid, ...u.data() });
        }
    }
    const friends = Array.from(unique.values());
    if (!friends.length) { friendsListDiv.innerHTML = '<div class="loading-users">No friends found</div>'; return; }
    friendsListDiv.innerHTML = '';
    friends.forEach(f => {
        const div = document.createElement('div');
        div.className = 'user-item';
        div.innerHTML = `<div class="user-avatar"><span>${f.name.charAt(0).toUpperCase()}</span><span class="${f.online ? 'online-dot' : 'offline-dot'}"></span></div><div class="user-info"><div class="user-name">${escapeHtml(f.name)}</div><div class="user-email">${escapeHtml(f.email)}</div>${f.bio ? `<div class="user-bio">${escapeHtml(f.bio.substring(0, 40))}</div>` : ''}</div><button class="add-friend-btn unfriend-btn" data-uid="${f.uid}" data-name="${f.name}">Unfriend</button>`;
        div.querySelector('.unfriend-btn').addEventListener('click', (e) => { e.stopPropagation(); unfriendUser(f.uid, f.name); });
        div.addEventListener('click', () => openChat(f));
        friendsListDiv.appendChild(div);
    });
}

async function loadAllUsers() {
    if (!currentUser) return;
    allUsersListDiv.innerHTML = '<div class="loading-users">Loading...</div>';
    const users = [];
    const all = await getDocs(collection(db, 'users'));
    const friends = await getDocs(query(collection(db, 'friends'), where('userId', '==', currentUser.uid)));
    const friendIds = new Set(friends.docs.map(d => d.data().friendId));
    all.forEach(d => { if (d.id !== currentUser.uid && !friendIds.has(d.id)) users.push({ uid: d.id, ...d.data() }); });
    allUsersCache = users;
    displayUsersList(users);
}

async function loadProfile() {
    if (!currentUser) return;
    const u = await getDoc(doc(db, 'users', currentUser.uid));
    const d = u.data();
    avatarPlaceholder.textContent = (d.name || currentUser.email).charAt(0).toUpperCase();
    profileName.value = d.name || '';
    profileEmail.value = d.email || '';
    profileBio.value = d.bio || '';
}

updateProfileBtn?.addEventListener('click', async () => {
    const newName = profileName.value.trim();
    const newBio = profileBio.value.trim();
    if (newName) {
        await updateProfile(auth.currentUser, { displayName: newName });
        await updateDoc(doc(db, 'users', currentUser.uid), { name: newName, bio: newBio });
        showToast('Updated', 'Profile updated!', 'success');
        avatarPlaceholder.textContent = newName.charAt(0).toUpperCase();
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
    if (!currentUser) return showToast('Error', 'Please login first', 'warning');
    const text = messageInput?.value.trim();
    if (!text) return;
    
    if (currentChatType === 'group' && currentGroup) {
        await addDoc(collection(db, 'group_chats', currentGroup.id, 'messages'), {
            text: text, senderId: currentUser.uid, senderName: currentUser.displayName || currentUser.email.split('@')[0],
            timestamp: new Date().toISOString()
        });
        messageInput.value = '';
    } else if (selectedFriend) {
        const chatId = currentUser.uid < selectedFriend.uid ? currentUser.uid + '_' + selectedFriend.uid : selectedFriend.uid + '_' + currentUser.uid;
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
            text: text, senderId: currentUser.uid, receiverId: selectedFriend.uid,
            timestamp: new Date().toISOString(), sent: true, delivered: false, read: false, seen: false
        });
        messageInput.value = '';
    } else {
        showToast('No Chat Selected', 'Select a friend or group to chat with', 'warning');
    }
}

async function openChat(friend) {
    if (!currentUser) return;
    currentChatType = 'private';
    currentGroup = null;
    selectedFriend = friend;
    currentChatId = currentUser.uid < friend.uid ? currentUser.uid + '_' + friend.uid : friend.uid + '_' + currentUser.uid;
    
    if (membersUnsubscribe) membersUnsubscribe();
    
    chatArea.classList.remove('hidden');
    welcomeSection.classList.add('hidden');
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    
    const friendDoc = await getDoc(doc(db, 'users', friend.uid));
    const friendData = friendDoc.data();
    chatAreaHeader.innerHTML = `<div class="selected-user-info"><div class="user-avatar" style="width:45px;height:45px;font-size:1.2rem;">${friend.name.charAt(0).toUpperCase()}</div><div><strong>${escapeHtml(friend.name)}</strong><div style="font-size:0.7rem;">${friendData?.online ? '🟢 Online' : '⚫ Offline'}</div>${friendData?.bio ? `<div style="font-size:0.65rem;color:#aaa;">${escapeHtml(friendData.bio.substring(0, 50))}</div>` : ''}</div></div>`;
    
    if (messagesUnsubscribe) messagesUnsubscribe();
    const q = query(collection(db, 'chats', currentChatId, 'messages'), orderBy('timestamp', 'asc'));
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) { messagesArea.innerHTML = '<div class="no-chat-selected">No messages yet</div>'; return; }
        messagesArea.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const isOwn = msg.senderId === currentUser.uid;
            const div = document.createElement('div');
            div.className = `message ${isOwn ? 'own' : 'other'}`;
            let time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            let status = '';
            if (isOwn) {
                if (msg.seen) status = '<span style="color:#000;">●</span>';
                else if (msg.delivered) status = '<span style="color:#00ffff;">✓✓</span>';
                else if (msg.sent) status = '<span style="color:#aaa;">✓</span>';
            }
            div.innerHTML = `<div class="message-bubble"><div class="message-text">${escapeHtml(msg.text)}</div><div class="message-time">${time} ${status}</div></div>`;
            messagesArea.appendChild(div);
        });
        messagesArea.scrollTop = messagesArea.scrollHeight;
    });
}

async function openGroupChat(group) {
    if (!currentUser) return;
    currentChatType = 'group';
    selectedFriend = null;
    currentGroup = group;
    currentChatId = `group_${group.id}`;
    
    chatArea.classList.remove('hidden');
    welcomeSection.classList.add('hidden');
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    
    const isAdmin = group.admins?.includes(currentUser.uid);
    chatAreaHeader.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:10px;">
            <div class="selected-user-info">
                <div class="group-avatar" style="width:45px;height:45px;border-radius:12px;background:linear-gradient(135deg,#00ffff,#8a2be2);display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.2rem;">${group.name.charAt(0).toUpperCase()}</div>
                <div>
                    <strong>${escapeHtml(group.name)}</strong>
                    <div style="font-size:0.7rem;">${group.members?.length || 0} members • ${isAdmin ? '👑 Admin' : 'Member'}</div>
                    ${group.description ? `<div style="font-size:0.65rem;color:#aaa;">${escapeHtml(group.description)}</div>` : ''}
                </div>
            </div>
            <div class="group-actions">
                <button id="groupSettingsBtn" class="group-action-btn" title="Group Settings" style="background:none;border:none;color:#00ffff;cursor:pointer;padding:5px;"><i class="fas fa-cog"></i> Settings</button>
            </div>
        </div>
    `;
    
    document.getElementById('groupSettingsBtn')?.addEventListener('click', () => openGroupSettings(group));
    
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (membersUnsubscribe) membersUnsubscribe();
    
    const messagesRef = collection(db, 'group_chats', group.id, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) { messagesArea.innerHTML = '<div class="no-chat-selected">No messages yet</div>'; return; }
        messagesArea.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            const isOwn = msg.senderId === currentUser.uid;
            const div = document.createElement('div');
            div.className = `message ${isOwn ? 'own' : 'other'}`;
            let time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            div.innerHTML = `<div class="message-bubble"><div class="message-text"><strong>${escapeHtml(msg.senderName || 'Unknown')}:</strong> ${escapeHtml(msg.text)}</div><div class="message-time">${time}</div></div>`;
            messagesArea.appendChild(div);
            if (!isOwn && !document.hasFocus()) {
                showNotification(`New message in ${group.name}`, `${msg.senderName}: ${msg.text.substring(0, 100)}`);
            }
        });
        messagesArea.scrollTop = messagesArea.scrollHeight;
    });
    
    // Load members - display inline below header, not as separate sidebar
    const loadMembersInline = async () => {
        const members = group.members || [];
        let membersHtml = '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding:8px;background:rgba(0,0,0,0.2);border-radius:10px;">';
        for (const memberId of members) {
            const userDoc = await getDoc(doc(db, 'users', memberId));
            if (userDoc.exists()) {
                const member = userDoc.data();
                const isOnline = member.online || false;
                const isAdminUser = group.admins?.includes(memberId);
                const isCreator = group.createdBy === memberId;
                membersHtml += `
                    <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(0,255,255,0.1);padding:4px 10px;border-radius:20px;">
                        <span style="width:8px;height:8px;border-radius:50%;background:${isOnline ? '#00ff88' : '#666'};"></span>
                        <span style="font-size:0.75rem;color:white;">${escapeHtml(member.name)}</span>
                        ${isCreator ? '<span style="font-size:0.6rem;color:#ffaa00;">👑</span>' : (isAdminUser ? '<span style="font-size:0.6rem;color:#00ffff;">👑</span>' : '')}
                        ${memberId === currentUser.uid ? '<span style="font-size:0.6rem;color:#00ffff;">(You)</span>' : ''}
                    </div>
                `;
            }
        }
        membersHtml += '</div>';
        if (!document.getElementById('groupMembersInline')) {
            const membersContainer = document.createElement('div');
            membersContainer.id = 'groupMembersInline';
            chatAreaHeader.appendChild(membersContainer);
        }
        const membersContainer = document.getElementById('groupMembersInline');
        if (membersContainer) membersContainer.innerHTML = membersHtml;
    };
    
    await loadMembersInline();
    const interval = setInterval(loadMembersInline, 5000);
    membersUnsubscribe = () => clearInterval(interval);
}

function closeChat() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    if (membersUnsubscribe) membersUnsubscribe();
    const membersContainer = document.getElementById('groupMembersInline');
    if (membersContainer) membersContainer.remove();
    selectedFriend = null;
    currentGroup = null;
    currentChatId = null;
    currentChatType = null;
    chatArea.classList.add('hidden');
    welcomeSection.classList.remove('hidden');
}

async function loadGroupsList() {
    if (!currentUser) return;
    groupsListDiv.innerHTML = '<div class="loading-users">Loading groups...</div>';
    const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUser.uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) { groupsListDiv.innerHTML = '<div class="loading-users">No groups yet. Create one!</div>'; return; }
    groupsListDiv.innerHTML = '';
    for (const docSnap of snapshot.docs) {
        const group = { id: docSnap.id, ...docSnap.data() };
        const div = document.createElement('div');
        div.className = 'group-item';
        div.style.cursor = 'pointer';
        const isAdmin = group.admins?.includes(currentUser.uid);
        div.innerHTML = `
            <div class="group-avatar">${group.name.charAt(0).toUpperCase()}</div>
            <div class="group-info">
                <div class="group-name">${escapeHtml(group.name)} ${isAdmin ? '<span style="font-size:0.7rem;color:#00ffff;">👑 Admin</span>' : ''}</div>
                <div class="group-description">${escapeHtml(group.description || 'No description')}</div>
                <div class="group-member-count"><i class="fas fa-users"></i> ${group.members?.length || 0} members</div>
            </div>
            <i class="fas fa-chevron-right" style="color:#00ffff;"></i>
        `;
        div.addEventListener('click', () => openGroupChat(group));
        groupsListDiv.appendChild(div);
    }
}

createGroupBtn?.addEventListener('click', async () => {
    selectedMembersForGroup.clear();
    await loadFriendsForGroupSelection();
    createGroupModal.classList.remove('hidden');
});

closeCreateModal?.addEventListener('click', () => {
    createGroupModal.classList.add('hidden');
    groupNameInput.value = '';
    groupDescriptionInput.value = '';
});

async function loadFriendsForGroupSelection() {
    const q = query(collection(db, 'friends'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    const friends = [];
    for (const docSnap of snapshot.docs) {
        const friendId = docSnap.data().friendId;
        const userDoc = await getDoc(doc(db, 'users', friendId));
        if (userDoc.exists()) friends.push({ uid: friendId, ...userDoc.data() });
    }
    groupMembersList.innerHTML = '';
    if (friends.length === 0) { groupMembersList.innerHTML = '<div class="loading-users">No friends to add. Add some friends first!</div>'; return; }
    friends.forEach(friend => {
        const div = document.createElement('div');
        div.className = 'group-member-item';
        div.innerHTML = `<div><input type="checkbox" class="add-member-checkbox" data-uid="${friend.uid}" data-name="${friend.name}"> <strong>${escapeHtml(friend.name)}</strong> (${escapeHtml(friend.email)})</div>`;
        const checkbox = div.querySelector('.add-member-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) selectedMembersForGroup.add(friend.uid);
            else selectedMembersForGroup.delete(friend.uid);
        });
        groupMembersList.appendChild(div);
    });
}

confirmCreateGroupBtn?.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    if (!groupName) { showToast('Error', 'Group name required', 'error'); return; }
    const members = [currentUser.uid, ...Array.from(selectedMembersForGroup)];
    const groupData = {
        name: groupName,
        description: groupDescriptionInput.value.trim() || '',
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        members: members,
        admins: [currentUser.uid]
    };
    const groupRef = await addDoc(collection(db, 'groups'), groupData);
    for (const memberId of members) {
        await addDoc(collection(db, 'group_members'), { groupId: groupRef.id, userId: memberId, joinedAt: new Date().toISOString() });
    }
    showToast('Success', `Group "${groupName}" created!`, 'success');
    createGroupModal.classList.add('hidden');
    groupNameInput.value = '';
    groupDescriptionInput.value = '';
    loadGroupsList();
});

async function openGroupSettings(group) {
    currentGroupForSettings = group;
    editGroupName.value = group.name || '';
    editGroupDescription.value = group.description || '';
    editGroupAvatar.value = group.avatar || '';
    
    const members = group.members || [];
    groupMembersManageList.innerHTML = '<div class="loading-users">Loading members...</div>';
    const memberData = [];
    for (const memberId of members) {
        const userDoc = await getDoc(doc(db, 'users', memberId));
        if (userDoc.exists()) memberData.push({ uid: memberId, ...userDoc.data() });
    }
    groupMembersManageList.innerHTML = '';
    memberData.forEach(member => {
        const div = document.createElement('div');
        div.className = 'group-member-item';
        const isAdmin = group.admins?.includes(member.uid);
        const isOwner = group.createdBy === member.uid;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                <div><strong>${escapeHtml(member.name)}</strong> (${escapeHtml(member.email)}) ${isOwner ? '👑 Owner' : (isAdmin ? '👑 Admin' : '')}</div>
                ${!isOwner && member.uid !== currentUser.uid ? `<button class="remove-member-btn" data-uid="${member.uid}" data-name="${member.name}" style="background:#ff4444;border:none;padding:4px 12px;border-radius:6px;color:white;cursor:pointer;">Remove</button>` : ''}
            </div>
        `;
        const removeBtn = div.querySelector('.remove-member-btn');
        removeBtn?.addEventListener('click', async () => {
            if (confirm(`Remove ${member.name} from group?`)) {
                await updateDoc(doc(db, 'groups', group.id), { members: arrayRemove(member.uid) });
                showToast('Removed', `${member.name} removed`, 'info');
                openGroupSettings(group);
                loadGroupsList();
                if (currentGroup?.id === group.id) openGroupChat(group);
            }
        });
        groupMembersManageList.appendChild(div);
    });
    
    await loadFriendsToAdd(group);
    groupSettingsModal.classList.remove('hidden');
}

async function loadFriendsToAdd(group) {
    const q = query(collection(db, 'friends'), where('userId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    const groupMembers = new Set(group.members || []);
    const availableFriends = [];
    for (const docSnap of snapshot.docs) {
        const friendId = docSnap.data().friendId;
        if (!groupMembers.has(friendId)) {
            const userDoc = await getDoc(doc(db, 'users', friendId));
            if (userDoc.exists()) availableFriends.push({ uid: friendId, ...userDoc.data() });
        }
    }
    allFriendsList = availableFriends;
    displayFriendsToAdd(availableFriends);
    
    searchFriendToAdd?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = availableFriends.filter(f => f.name.toLowerCase().includes(term) || f.email.toLowerCase().includes(term));
        displayFriendsToAdd(filtered);
    });
}

function displayFriendsToAdd(friends) {
    friendsToAddList.innerHTML = '';
    if (friends.length === 0) { friendsToAddList.innerHTML = '<div class="loading-users">No friends available to add</div>'; return; }
    friends.forEach(friend => {
        const div = document.createElement('div');
        div.className = 'group-member-item';
        div.innerHTML = `<div><input type="checkbox" class="add-friend-checkbox" data-uid="${friend.uid}"> <strong>${escapeHtml(friend.name)}</strong> (${escapeHtml(friend.email)})</div>`;
        friendsToAddList.appendChild(div);
    });
}

saveGroupSettingsBtn?.addEventListener('click', async () => {
    if (!currentGroupForSettings) return;
    const newName = editGroupName.value.trim();
    if (!newName) { showToast('Error', 'Group name required', 'error'); return; }
    await updateDoc(doc(db, 'groups', currentGroupForSettings.id), {
        name: newName,
        description: editGroupDescription.value.trim() || '',
        avatar: editGroupAvatar.value.trim() || ''
    });
    const selectedCheckboxes = friendsToAddList.querySelectorAll('.add-friend-checkbox:checked');
    const newMembers = [];
    selectedCheckboxes.forEach(cb => newMembers.push(cb.dataset.uid));
    if (newMembers.length > 0) {
        await updateDoc(doc(db, 'groups', currentGroupForSettings.id), { members: arrayUnion(...newMembers) });
        for (const memberId of newMembers) {
            await addDoc(collection(db, 'group_members'), { groupId: currentGroupForSettings.id, userId: memberId, joinedAt: new Date().toISOString() });
        }
    }
    showToast('Updated', 'Group settings updated!', 'success');
    groupSettingsModal.classList.add('hidden');
    loadGroupsList();
    if (currentGroup?.id === currentGroupForSettings.id) openGroupChat(currentGroupForSettings);
});

deleteGroupBtn?.addEventListener('click', async () => {
    if (!currentGroupForSettings) return;
    if (confirm(`Delete "${currentGroupForSettings.name}"? This cannot be undone.`)) {
        const members = await getDocs(query(collection(db, 'group_members'), where('groupId', '==', currentGroupForSettings.id)));
        for (const m of members.docs) await deleteDoc(doc(db, 'group_members', m.id));
        const messages = await getDocs(collection(db, 'group_chats', currentGroupForSettings.id, 'messages'));
        for (const msg of messages.docs) await deleteDoc(doc(db, 'group_chats', currentGroupForSettings.id, 'messages', msg.id));
        await deleteDoc(doc(db, 'groups', currentGroupForSettings.id));
        showToast('Deleted', 'Group deleted', 'success');
        groupSettingsModal.classList.add('hidden');
        loadGroupsList();
        if (currentGroup?.id === currentGroupForSettings.id) closeChat();
    }
});

closeGroupSettingsModal?.addEventListener('click', () => groupSettingsModal.classList.add('hidden'));

sendBtn?.addEventListener('click', sendMessage);
messageInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

emojiBtn?.addEventListener('click', (e) => { e.stopPropagation(); emojiPicker.classList.toggle('hidden'); });
document.querySelectorAll('.emoji').forEach(emoji => {
    emoji.addEventListener('click', () => { messageInput.value += emoji.textContent; emojiPicker.classList.add('hidden'); messageInput.focus(); });
});
document.addEventListener('click', (e) => { if (!emojiPicker?.contains(e.target) && !emojiBtn?.contains(e.target)) emojiPicker?.classList.add('hidden'); });

chatsTab?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.remove('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    welcomeSection.classList.add('hidden');
    loadFriendsList();
});

findFriendsTab?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.remove('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    welcomeSection.classList.add('hidden');
    loadAllUsers();
});

requestsTab?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.remove('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    welcomeSection.classList.add('hidden');
    loadPendingRequests();
});

groupsTab?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.remove('hidden');
    welcomeSection.classList.add('hidden');
    loadGroupsList();
});

profileSettingsBtn?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.remove('hidden');
    notificationPanel.classList.add('hidden');
    groupsPanel.classList.add('hidden');
    welcomeSection.classList.add('hidden');
    loadProfile();
});

notificationSettingsBtn?.addEventListener('click', () => {
    closeChat();
    chatsPanel.classList.add('hidden');
    findFriendsPanel.classList.add('hidden');
    requestsPanel.classList.add('hidden');
    profilePanel.classList.add('hidden');
    notificationPanel.classList.remove('hidden');
    groupsPanel.classList.add('hidden');
    welcomeSection.classList.add('hidden');
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
        loadGroupsList();
        if (chatsTab) chatsTab.click();
        showToast('Welcome Back!', `Hello ${user.displayName || user.email.split('@')[0]}`, 'success');
    } else {
        if (currentUser) await updateDoc(doc(db, 'users', currentUser.uid), { online: false });
        currentUser = null; selectedFriend = null; currentGroup = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (membersUnsubscribe) membersUnsubscribe();
        const membersContainer = document.getElementById('groupMembersInline');
        if (membersContainer) membersContainer.remove();
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

console.log("========================================");
console.log("HemalChatApp - Complete Group Chat System");
console.log("✅ Group Chat | ✅ Member List | ✅ Online/Offline Status");
console.log("✅ Group Settings | ✅ Private Chat | ✅ Friend System");
console.log("Created by Hemal Das");
console.log("========================================");
