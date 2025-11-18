/**
 * Freelance Hub - JavaScript (MySQL Backend)
 */

// API Base URL
const API_URL = 'http://localhost:5500';

// ========== UTILITY FUNCTIONS ==========

/**
 * Set current logged-in user
 */
function setCurrentUser(user) {
    localStorage.setItem('fh_current', JSON.stringify(user));
}

/**
 * Get current logged-in user
 */
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('fh_current'));
    } catch {
        return null;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ========== USER MANAGEMENT ==========

/**
 * Register a new user
 */
async function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value.trim();
    const role = document.getElementById('regRole').value;

    // Validation
    if (!name || !email || !password) {
        return alert('All fields are required!');
    }

    if (!isValidEmail(email)) {
        return alert('Please enter a valid email address!');
    }

    if (password.length < 6) {
        return alert('Password must be at least 6 characters long!');
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Registration successful! Please login.');
            window.location.href = 'login.html';
        } else {
            alert(data.message || 'Registration failed!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error! Please make sure backend is running.');
    }
}

/**
 * Login user
 */
async function loginUser() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value.trim();

    if (!email || !password) {
        return alert('Please enter both email and password!');
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.status === 'success') {
            setCurrentUser(data.user);
            alert(`Welcome back, ${data.user.name}!`);
            window.location.href = 'home.html';
        } else {
            alert(data.message || 'Invalid credentials!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error! Please make sure backend is running.');
    }
}

/**
 * Logout user
 */
function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('fh_current');
        alert('You have been logged out successfully!');
        window.location.href = 'home.html';
    }
}

/**
 * Update navigation based on login status
 */
function updateNavigation() {
    const currentUser = getCurrentUser();
    const nav = document.querySelector('nav');
    
    if (!nav) return;

    if (currentUser) {
        // User is logged in - show profile with user name, admin, and logout
        nav.innerHTML = `
            <a href="home.html">Jobs</a>
            <a href="postjob.html">Post Job</a>
            <a href="admin.html">Admin</a>
            <a href="profile.html" class="profile-nav">
                <span class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</span>
                ${currentUser.name}
            </a>
            <a href="#" onclick="logoutUser(); return false;" class="logout-btn">Logout</a>
        `;
    } else {
        // User is not logged in - show register and login
        nav.innerHTML = `
            <a href="home.html">Jobs</a>
            <a href="postjob.html">Post Job</a>
            <a href="register.html">Register</a>
            <a href="login.html">Login</a>
        `;
    }
}

// ========== JOB MANAGEMENT ==========

/**
 * Post a new job
 */
async function postJob() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
        return alert('Please login to post a job!');
    }

    if (currentUser.role !== 'client') {
        return alert('Only clients can post jobs!');
    }

    const title = document.getElementById('jobTitle').value.trim();
    const description = document.getElementById('jobDesc').value.trim();
    const contact = document.getElementById('jobContact').value.trim();

    if (!title || !description || !contact) {
        return alert('All fields are required!');
    }

    if (title.length < 5) {
        return alert('Job title must be at least 5 characters long!');
    }

    try {
        const response = await fetch(`${API_URL}/jobs/post`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: currentUser.user_id,
                title,
                description,
                contact
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Job posted successfully!');
            window.location.href = 'home.html';
        } else {
            alert(data.message || 'Failed to post job!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error! Please make sure backend is running.');
    }
}

/**
 * Display all jobs on homepage
 */
async function displayJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    const currentUser = getCurrentUser();

    try {
        const response = await fetch(`${API_URL}/jobs/all`);
        const data = await response.json();

        if (data.status === 'success') {
            const jobs = data.jobs;

            if (jobs.length === 0) {
                jobsList.innerHTML = '<p>No jobs available at the moment. Check back later!</p>';
                return;
            }

            jobsList.innerHTML = '';

            jobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';

                const statusClass = job.status === 'pending' ? 'status-pending' : 
                                   job.status === 'assigned' ? 'status-assigned' : 'status-completed';

                jobCard.innerHTML = `
                    <h3>${escapeHtml(job.title)}</h3>
                    <p>${escapeHtml(job.description)}</p>
                    <p><b>Posted by:</b> ${escapeHtml(job.client_name || 'Unknown')}</p>
                    <p><b>Contact:</b> ${escapeHtml(job.contact_info)}</p>
                    <p><b>Status:</b> <span class="${statusClass}">${job.status.toUpperCase()}</span></p>
                    <p><b>Posted on:</b> ${new Date(job.created_at).toLocaleDateString()}</p>
                `;

                // Show action buttons
                const buttonContainer = document.createElement('div');
                buttonContainer.style.marginTop = '15px';

                // Show Pick Job button for freelancers (if job not assigned)
                if (currentUser && currentUser.role === 'freelancer' && !job.freelancer_id && job.status === 'pending') {
                    const pickBtn = document.createElement('button');
                    pickBtn.className = 'small-btn pick-btn';
                    pickBtn.textContent = '✓ Pick This Job';
                    pickBtn.onclick = () => pickJob(job.job_id);
                    buttonContainer.appendChild(pickBtn);
                }

                // Show management buttons to job owner
                if (currentUser && currentUser.user_id === job.client_id) {
                    if (job.status === 'pending') {
                        const completeBtn = document.createElement('button');
                        completeBtn.className = 'small-btn';
                        completeBtn.textContent = 'Mark Complete';
                        completeBtn.onclick = () => markJobComplete(job.job_id);
                        buttonContainer.appendChild(completeBtn);
                    }

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'small-btn';
                    deleteBtn.textContent = 'Delete';
                    deleteBtn.onclick = () => deleteJob(job.job_id);
                    buttonContainer.appendChild(deleteBtn);
                }

                if (buttonContainer.children.length > 0) {
                    jobCard.appendChild(buttonContainer);
                }

                jobsList.appendChild(jobCard);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        jobsList.innerHTML = '<p>Error loading jobs. Please make sure backend is running.</p>';
    }
}

/**
 * Delete a job
 */
async function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this job?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/jobs/delete/${jobId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Job deleted successfully!');
            location.reload();
        } else {
            alert(data.message || 'Failed to delete job!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error!');
    }
}

/**
 * Mark job as completed
 */
async function markJobComplete(jobId) {
    try {
        const response = await fetch(`${API_URL}/jobs/complete/${jobId}`, {
            method: 'PUT'
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Job marked as completed!');
            location.reload();
        } else {
            alert(data.message || 'Failed to update job!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error!');
    }
}

// ========== ADMIN PANEL ==========

/**
 * Display admin panel data
 */
async function displayAdminPanel() {
    const usersContainer = document.getElementById('adminUsers');
    const jobsContainer = document.getElementById('adminJobs');

    if (!usersContainer || !jobsContainer) return;

    try {
        // Fetch all jobs (we'll use this to get user data too)
        const response = await fetch(`${API_URL}/jobs/all`);
        const data = await response.json();

        if (data.status === 'success') {
            const jobs = data.jobs;

            // Extract unique users from jobs
            const usersMap = new Map();
            jobs.forEach(job => {
                if (job.client_id && !usersMap.has(job.client_id)) {
                    usersMap.set(job.client_id, {
                        user_id: job.client_id,
                        name: job.client_name,
                        created_at: job.created_at
                    });
                }
            });

            const users = Array.from(usersMap.values());

            // Display Users
            if (users.length === 0) {
                usersContainer.innerHTML = '<p>No users found.</p>';
            } else {
                usersContainer.innerHTML = '';
                users.forEach(user => {
                    const userItem = document.createElement('div');
                    userItem.className = 'admin-item';
                    userItem.innerHTML = `
                        <b>${escapeHtml(user.name)}</b> (ID: ${user.user_id})
                        <br><small>First seen: ${new Date(user.created_at).toLocaleDateString()}</small>
                    `;
                    usersContainer.appendChild(userItem);
                });
            }

            // Display Jobs
            if (jobs.length === 0) {
                jobsContainer.innerHTML = '<p>No jobs posted yet.</p>';
            } else {
                jobsContainer.innerHTML = '';
                jobs.forEach(job => {
                    const jobItem = document.createElement('div');
                    jobItem.className = 'admin-item';
                    jobItem.innerHTML = `
                        <b>${escapeHtml(job.title)}</b> – Posted by ${escapeHtml(job.client_name || 'Unknown')}
                        <br>Status: <span class="${job.status === 'pending' ? 'status-pending' : 'status-completed'}">${job.status.toUpperCase()}</span>
                        <br><small>Posted: ${new Date(job.created_at).toLocaleDateString()}</small>
                    `;
                    jobsContainer.appendChild(jobItem);
                });
            }
        }
    } catch (error) {
        console.error('Error:', error);
        usersContainer.innerHTML = '<p>Error loading data. Please make sure backend is running.</p>';
        jobsContainer.innerHTML = '<p>Error loading data.</p>';
    }
}

// ========== PROFILE MANAGEMENT ==========
/**
 * Load and display user profile
 */
async function loadProfile() {
    const profileSection = document.getElementById('profileSection');
    if (!profileSection) return;

    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/profile/${currentUser.user_id}`);
        const data = await response.json();

        if (data.status === 'success') {
            const user = data.user;
            displayProfileData(user);
            
            // Load jobs based on role
            if (user.role === 'freelancer') {
                loadFreelancerJobs(user.user_id);
            } else {
                loadClientJobs(user.user_id);
            }
        }
    } catch (error) {
        console.error('Error:', error);
        profileSection.innerHTML = '<p>Error loading profile.</p>';
    }
}

/**
 * Display profile data
 */
function displayProfileData(user) {
    const profileSection = document.getElementById('profileSection');
    
    profileSection.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="profile-info">
                    <h2>${escapeHtml(user.name)}</h2>
                    <p class="profile-role">${user.role.toUpperCase()}</p>
                    <p class="profile-email">${escapeHtml(user.email)}</p>
                </div>
                <button class="edit-btn" onclick="openEditModal()">
                    ${user.profile_completed ? 'Edit Profile' : 'Complete Profile'}
                </button>
            </div>
            
            ${user.profile_completed ? `
                <div class="profile-details">
                    ${user.age ? `<p><b>Age:</b> ${user.age}</p>` : ''}
                    ${user.skills ? `<p><b>Skills:</b> ${escapeHtml(user.skills)}</p>` : ''}
                    ${user.contact_info ? `<p><b>Contact:</b> ${escapeHtml(user.contact_info)}</p>` : ''}
                    ${user.github_link ? `<p><b>GitHub:</b> <a href="${escapeHtml(user.github_link)}" target="_blank">${escapeHtml(user.github_link)}</a></p>` : ''}
                    <p><b>Joined:</b> ${new Date(user.created_at).toLocaleDateString()}</p>
                </div>
            ` : '<p class="incomplete-msg">"Complete Profile"</p>'}
        </div>
    `;
}

/**
 * Open edit profile modal
 */
function openEditModal() {
    const currentUser = getCurrentUser();
    
    fetch(`${API_URL}/auth/profile/${currentUser.user_id}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const user = data.user;
                document.getElementById('editName').value = user.name || '';
                document.getElementById('editAge').value = user.age || '';
                document.getElementById('editSkills').value = user.skills || '';
                document.getElementById('editContact').value = user.contact_info || '';
                document.getElementById('editGithub').value = user.github_link || '';
                
                document.getElementById('editModal').style.display = 'block';
            }
        });
}

/**
 * Close edit modal
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

/**
 * Save profile
 */
async function saveProfile() {
    const currentUser = getCurrentUser();
    
    const name = document.getElementById('editName').value.trim();
    const age = document.getElementById('editAge').value;
    const skills = document.getElementById('editSkills').value.trim();
    const contact = document.getElementById('editContact').value.trim();
    const github = document.getElementById('editGithub').value.trim();

    if (!name) {
        return alert('Name is required!');
    }

    try {
        const response = await fetch(`${API_URL}/auth/profile/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                name,
                age: age || null,
                skills,
                contact_info: contact,
                github_link: github
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Profile updated successfully!');
            closeEditModal();
            
            // Update current user data
            currentUser.name = name;
            setCurrentUser(currentUser);
            
            loadProfile();
        } else {
            alert(data.message || 'Failed to update profile!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error!');
    }
}

/**
 * Load freelancer's assigned jobs
 */
async function loadFreelancerJobs(freelancerId) {
    const jobsList = document.getElementById('myJobsList');
    
    try {
        const response = await fetch(`${API_URL}/jobs/freelancer/${freelancerId}`);
        const data = await response.json();

        if (data.status === 'success') {
            const jobs = data.jobs;

            if (jobs.length === 0) {
                jobsList.innerHTML = '<p>No jobs assigned yet. Browse jobs and pick one!</p>';
                return;
            }

            jobsList.innerHTML = '';
            jobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                const statusClass = job.status === 'pending' ? 'status-pending' : 
                                   job.status === 'assigned' ? 'status-assigned' : 'status-completed';

                jobCard.innerHTML = `
                    <h3>${escapeHtml(job.title)}</h3>
                    <p>${escapeHtml(job.description)}</p>
                    <p><b>Client:</b> ${escapeHtml(job.client_name)}</p>
                    <p><b>Client Email:</b> ${escapeHtml(job.client_email)}</p>
                    <p><b>Contact:</b> ${escapeHtml(job.contact_info)}</p>
                    <p><b>Status:</b> <span class="${statusClass}">${job.status.toUpperCase()}</span></p>
                    <p><b>Assigned on:</b> ${new Date(job.assigned_at).toLocaleDateString()}</p>
                `;
                
                jobsList.appendChild(jobCard);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        jobsList.innerHTML = '<p>Error loading jobs.</p>';
    }
}

/**
 * Load client's posted jobs
 */
async function loadClientJobs(clientId) {
    const jobsList = document.getElementById('myJobsList');
    
    try {
        const response = await fetch(`${API_URL}/jobs/client/${clientId}`);
        const data = await response.json();

        if (data.status === 'success') {
            const jobs = data.jobs;

            if (jobs.length === 0) {
                jobsList.innerHTML = '<p>You haven\'t posted any jobs yet.</p>';
                return;
            }

            jobsList.innerHTML = '';
            jobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                const statusClass = job.status === 'pending' ? 'status-pending' : 
                                   job.status === 'assigned' ? 'status-assigned' : 'status-completed';

                jobCard.innerHTML = `
                    <h3>${escapeHtml(job.title)}</h3>
                    <p>${escapeHtml(job.description)}</p>
                    <p><b>Status:</b> <span class="${statusClass}">${job.status.toUpperCase()}</span></p>
                    <p><b>Posted on:</b> ${new Date(job.created_at).toLocaleDateString()}</p>
                    ${job.freelancer_id ? `<p><b>Status:</b> Assigned to Freelancer</p>` : '<p><b>Status:</b> Not assigned yet</p>'}
                `;

                const buttonContainer = document.createElement('div');
                buttonContainer.style.marginTop = '15px';

                if (job.status === 'pending') {
                    const completeBtn = document.createElement('button');
                    completeBtn.className = 'small-btn';
                    completeBtn.textContent = 'Mark Complete';
                    completeBtn.onclick = () => markJobComplete(job.job_id);
                    buttonContainer.appendChild(completeBtn);
                }

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'small-btn';
                deleteBtn.textContent = 'Delete';
                deleteBtn.onclick = () => deleteJob(job.job_id);
                buttonContainer.appendChild(deleteBtn);

                jobCard.appendChild(buttonContainer);
                jobsList.appendChild(jobCard);
            });
        }
    } catch (error) {
        console.error('Error:', error);
        jobsList.innerHTML = '<p>Error loading jobs.</p>';
    }
}

/**
 * Assign job to freelancer
 */
async function pickJob(jobId) {
    const currentUser = getCurrentUser();

    if (!currentUser || currentUser.role !== 'freelancer') {
        return alert('Only freelancers can pick jobs!');
    }

    if (!confirm('Do you want to pick this job?')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/jobs/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: jobId,
                freelancer_id: currentUser.user_id
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Job picked successfully! Check your profile for details.');
            location.reload();
        } else {
            alert(data.message || 'Failed to pick job!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error!');
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
    updateNavigation(); // Update nav based on login status
    displayJobs();
    displayAdminPanel();
    loadProfile();
});