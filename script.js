/**
 * Freelance Hub - Enhanced JavaScript (MySQL Backend)
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
    if (!str) return '';
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

/**
 * Format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

/**
 * Format date
 */
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get client IP and User Agent
 */
async function getClientInfo() {
    return {
        ip_address: await fetch('https://api.ipify.org?format=json')
            .then(res => res.json())
            .then(data => data.ip)
            .catch(() => '0.0.0.0'),
        user_agent: navigator.userAgent
    };
}
// PRO EDIT JOB — MODAL STYLE (Upwork jaisa feel)
function editJob(jobId) {
    // Pehle job details fetch karo
    fetch(`${API_URL}/jobs/${jobId}`)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'success') return alert("Job not found");

            const job = data.job;

            // Modal banao ya existing modal use karo
            const modalHtml = `
                <div id="editJobModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:9999; display:flex; align-items:center; justify-content:center;">
                    <div style="background:#111; padding:30px; border-radius:12px; width:90%; max-width:600px; border:2px solid #ff6b6b;">
                        <h2 style="color:#ff6b6b; margin-top:0;">Edit Job</h2>
                        <form id="editJobForm">
                            <input type="hidden" name="job_id" value="${jobId}">
                            <label>Title</label>
                            <input type="text" id="editTitle" value="${escapeHtml(job.title)}" style="width:100%; padding:10px; margin:10px 0; background:#222; border:1px solid #444; color:white; border-radius:6px;">

                            <label>Description</label>
                            <textarea id="editDesc" style="width:100%; height:150px; padding:10px; margin:10px 0; background:#222; border:1px solid #444; color:white; border-radius:6px;">${escapeHtml(job.description)}</textarea>

                            <label>Budget (Min - Max)</label>
                            <div style="display:flex; gap:10px;">
                                <input type="number" id="editMin" value="${job.budget_min}" placeholder="Min" style="width:50%; padding:10px;">
                                <input type="number" id="editMax" value="${job.budget_max}" placeholder="Max" style="width:50%; padding:10px;">
                            </div>

                            <div style="margin-top:20px; text-align:right;">
                                <button type="button" onclick="document.getElementById('editJobModal').remove()" style="background:#444; color:white; padding:10px 20px; border:none; border-radius:6px; margin-right:10px;">Cancel</button>
                                <button type="submit" style="background:#28a745; color:white; padding:10px 25px; border:none; border-radius:6px;">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Form submit handle
            document.getElementById('editJobForm').onsubmit = async (e) => {
                e.preventDefault();

                const updatedJob = {
                    job_id: jobId,
                    title: document.getElementById('editTitle').value,
                    description: document.getElementById('editDesc').value,
                    budget_min: document.getElementById('editMin').value,
                    budget_max: document.getElementById('editMax').value
                };

                try {
                    const res = await fetch(`${API_URL}/jobs/update`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(updatedJob)
                    });

                    const result = await res.json();
                    if (result.status === 'success') {
                        alert("Job updated successfully!");
                        document.getElementById('editJobModal').remove();
                        location.reload(); // ya loadJobs() call kar
                    } else {
                        alert("Error: " + result.message);
                    }
                } catch (err) {
                    alert("Server error");
                }
            };
        });
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
    const phone = document.getElementById('regPhone')?.value.trim();

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
            body: JSON.stringify({ name, email, password, role, phone })
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
        const clientInfo = await getClientInfo();
        
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email, 
                password,
                ip_address: clientInfo.ip_address,
                user_agent: clientInfo.user_agent
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            setCurrentUser(data.user);
            alert(`Welcome back, ${data.user.name}!`);
            
            // Load notifications
            loadNotifications(data.user.user_id);
            
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
        window.location.href = 'landing.html';
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
        // User is logged in
        nav.innerHTML = `
            <a href="home.html">Browse Jobs</a>
            <a href="postjob.html">Post Job</a>
            <a href="my-proposals.html">My Proposals</a>
            <a href="messages.html">Messages <span id="unreadMessages" class="badge"></span></a>
            <a href="wallet.html">Wallet</a>
            <a href="profile.html" class="profile-nav">
                <span class="user-avatar">${currentUser.name.charAt(0).toUpperCase()}</span>
                ${currentUser.name}
            </a>
            <a href="#" onclick="logoutUser(); return false;" class="logout-btn">Logout</a>
        `;
        
        // Load unread message count
        loadUnreadMessageCount(currentUser.user_id);
    } else {
        // User is not logged in
        nav.innerHTML = `
            <a href="home.html">Browse Jobs</a>
            <a href="register.html">Register</a>
            <a href="login.html">Login</a>
        `;
    }
}

// ========== JOB MANAGEMENT ==========

/**
 * Post a new job - Enhanced
 */
async function postJob() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert("Login karo pehle!");
        window.location.href = 'login.html';
        return;
    }

    if (currentUser.role !== 'client') {
        alert("Sirf client post kar sakta hai job!");
        return;
    }

    const title = document.getElementById('jobTitle').value.trim();
    const category_id = document.getElementById('jobCategory').value;
    const description = document.getElementById('jobDesc').value.trim();
    const requirements = document.getElementById('jobRequirements').value.trim();
    const budgetType = document.getElementById('budgetType').value;
    const budgetMin = parseFloat(document.getElementById('budgetMin').value) || 0;
    const budgetMax = parseFloat(document.getElementById('budgetMax').value) || 0;
    const duration = document.getElementById('duration').value.trim();
    const experienceLevel = document.getElementById('experienceLevel').value;
    const deadline = document.getElementById('deadline').value || null;

    // Collect selected skills
    const skills = Array.from(document.querySelectorAll('#skillsCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (!title || !description) {
        return alert("Title aur Description mandatory hai!");
    }

    try {
        const response = await fetch(`${API_URL}/jobs/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: currentUser.user_id,
                category_id,
                title,
                description,
                requirements: requirements || null,
                budget_type: budgetType,
                budget_min: budgetMin,
                budget_max: budgetMax,
                duration,
                experience_level: experienceLevel,   // backend map karega entry → beginner
                deadline,
                skills
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert("🎉 Job successfully posted!");
            window.location.href = 'home.html';
        } else {
            alert("❌ Error: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Server off hai ya backend nahi chal raha");
    }
}

/**
 * Display all jobs on homepage - Enhanced
 */
async function displayJobs() {
    const jobsList = document.getElementById('jobsList');
    if (!jobsList) return;

    const currentUser = getCurrentUser();

    // Get filter values
    const categoryFilter = document.getElementById('filterCategory')?.value;
    const experienceFilter = document.getElementById('filterExperience')?.value;

    let url = `${API_URL}/jobs/all?`;
    if (categoryFilter) url += `category_id=${categoryFilter}&`;
    if (experienceFilter) url += `experience_level=${experienceFilter}&`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'success') {
            const jobs = data.jobs;

            if (jobs.length === 0) {
                jobsList.innerHTML = '<p class="empty-state">No jobs available at the moment. Check back later!</p>';
                return;
            }

            jobsList.innerHTML = '';

            jobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';

                const statusClass = getStatusClass(job.status);
                const budgetDisplay = job.budget_type === 'hourly' 
                    ? `${formatCurrency(job.budget_min)}/hr - ${formatCurrency(job.budget_max)}/hr`
                    : `${formatCurrency(job.budget_min)} - ${formatCurrency(job.budget_max)}`;

                jobCard.innerHTML = `
                    <div class="job-header">
                        <h3>${escapeHtml(job.title)}</h3>
                        <span class="badge ${statusClass}">${job.status.toUpperCase()}</span>
                    </div>
                    <p class="job-description">${escapeHtml(job.description)}</p>
                    ${job.category_name ? `<p><strong>Category:</strong> ${escapeHtml(job.category_name)}</p>` : ''}
                    <p><strong>Budget:</strong> ${budgetDisplay} (${job.budget_type})</p>
                    ${job.duration ? `<p><strong>Duration:</strong> ${escapeHtml(job.duration)}</p>` : ''}
                    <p><strong>Experience Level:</strong> ${escapeHtml(job.experience_level)}</p>
                    ${job.required_skills ? `<p><strong>Skills:</strong> ${escapeHtml(job.required_skills)}</p>` : ''}
                    <p><strong>Posted by:</strong> ${escapeHtml(job.client_name || 'Unknown')}</p>
                    <p><strong>Proposals:</strong> ${job.total_proposals || 0} | <strong>Views:</strong> ${job.views_count || 0}</p>
                    <p class="job-date"><strong>Posted:</strong> ${formatDate(job.created_at)}</p>
                `;

                // Show action buttons
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'job-actions';

                // View Details button for all
                const viewBtn = document.createElement('button');
                viewBtn.className = 'btn btn-secondary';
                viewBtn.textContent = 'View Details';
                viewBtn.onclick = () => viewJobDetails(job.job_id);
                buttonContainer.appendChild(viewBtn);

                // Proposal button for freelancers
                if (currentUser && currentUser.role === 'freelancer' && job.status === 'pending') {
                    const proposalBtn = document.createElement('button');
                    proposalBtn.className = 'btn btn-primary';
                    proposalBtn.textContent = '✉ Submit Proposal';
                    proposalBtn.onclick = () => openProposalModal(job.job_id);
                    buttonContainer.appendChild(proposalBtn);

                    // Save job button
                    const saveBtn = document.createElement('button');
                    saveBtn.className = 'btn btn-outline';
                    saveBtn.textContent = '⭐ Save Job';
                    saveBtn.onclick = () => saveJob(job.job_id);
                    buttonContainer.appendChild(saveBtn);
                }

                // Management buttons for job owner
                if (currentUser && currentUser.user_id === job.client_id) {
                    const proposalsBtn = document.createElement('button');
                    proposalsBtn.className = 'btn btn-info';
                    proposalsBtn.textContent = `View Proposals (${job.total_proposals || 0})`;
                    proposalsBtn.onclick = () => viewProposals(job.job_id);
                    buttonContainer.appendChild(proposalsBtn);

                    if (job.status === 'pending' || job.status === 'assigned') {
                        const editBtn = document.createElement('button');
                        editBtn.className = 'btn btn-secondary';
                        editBtn.textContent = 'Edit';
                        editBtn.onclick = () => editJob(job.job_id);
                        buttonContainer.appendChild(editBtn);
                    }

                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn btn-danger';
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
        jobsList.innerHTML = '<p class="error-message">Error loading jobs. Please make sure backend is running.</p>';
    }
}

/**
 * Get status class for styling
 */
function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'assigned': 'status-assigned',
        'in_progress': 'status-progress',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    };
    return statusMap[status] || 'status-pending';
}

/**
 * View job details
 */
async function viewJobDetails(jobId) {
    window.location.href = `job-details.html?id=${jobId}`;
}

/**
 * Open proposal submission modal
 */
function openProposalModal(jobId) {
    // Store job ID for later use
    document.getElementById('proposalJobId').value = jobId;
    document.getElementById('proposalModal').style.display = 'block';
}

/**
 * Close proposal modal
 */
function closeProposalModal() {
    document.getElementById('proposalModal').style.display = 'none';
}

/**
 * Submit proposal
 */
async function submitProposal() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return alert('Please login first!');
    }

    const jobId = document.getElementById('proposalJobId').value;
    const coverLetter = document.getElementById('proposalCoverLetter').value.trim();
    const budget = document.getElementById('proposalBudget').value;
    const duration = document.getElementById('proposalDuration').value.trim();

    if (!coverLetter || !budget) {
        return alert('Cover letter and proposed budget are required!');
    }

    try {
        const response = await fetch(`${API_URL}/jobs/proposal/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: jobId,
                freelancer_id: currentUser.user_id,
                cover_letter: coverLetter,
                proposed_budget: budget,
                proposed_duration: duration
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('Proposal submitted successfully!');
            closeProposalModal();
            displayJobs();
        } else {
            alert(data.message || 'Failed to submit proposal!');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Server error!');
    }
}

/**
 * View proposals for a job
 */
async function viewProposals(jobId) {
    window.location.href = `proposals.html?job_id=${jobId}`;
}

/**
 * Save/Bookmark job
 */
async function saveJob(jobId) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return alert('Please login to save jobs!');
    }

    try {
        const response = await fetch(`${API_URL}/jobs/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                job_id: jobId
            })
        });

        const data = await response.json();
        alert(data.message);
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to save job!');
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

// ========== PROFILE MANAGEMENT ==========

/**
 * Load and display user profile - Enhanced
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
 * Display profile data - Enhanced
 */
function displayProfileData(user) {
    const profileSection = document.getElementById('profileSection');
    
    const ratingStars = user.avg_rating 
        ? '⭐'.repeat(Math.round(user.avg_rating))
        : 'No ratings yet';
    
    profileSection.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-large">
                    ${user.profile_picture 
                        ? `<img src="${escapeHtml(user.profile_picture)}" alt="Profile">` 
                        : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="profile-info">
                    <h2>${escapeHtml(user.name)} ${user.is_verified ? '<span class="verified-badge">✓</span>' : ''}</h2>
                    ${user.title ? `<p class="profile-title">${escapeHtml(user.title)}</p>` : ''}
                    <p class="profile-role">${user.role.toUpperCase()}</p>
                    <p class="profile-email">${escapeHtml(user.email)}</p>
                    ${user.phone ? `<p class="profile-phone">📞 ${escapeHtml(user.phone)}</p>` : ''}
                </div>
                <button class="btn btn-primary" onclick="openEditModal()">
                    ${user.profile_completed ? 'Edit Profile' : 'Complete Profile'}
                </button>
            </div>
            
            ${user.profile_completed ? `
                <div class="profile-stats">
                    <div class="stat-card">
                        <h4>${user.total_jobs_completed || 0}</h4>
                        <p>Jobs Completed</p>
                    </div>
                    <div class="stat-card">
                        <h4>${formatCurrency(user.total_earnings || 0)}</h4>
                        <p>Total Earnings</p>
                    </div>
                    <div class="stat-card">
                        <h4>${user.success_rate || 0}%</h4>
                        <p>Success Rate</p>
                    </div>
                    <div class="stat-card">
                        <h4>${ratingStars}</h4>
                        <p>${user.total_reviews || 0} Reviews</p>
                    </div>
                </div>
                
                <div class="profile-details">
                    ${user.bio ? `<div class="detail-section"><h4>About</h4><p>${escapeHtml(user.bio)}</p></div>` : ''}
                    ${user.hourly_rate ? `<p><strong>Hourly Rate:</strong> ${formatCurrency(user.hourly_rate)}/hr</p>` : ''}
                    ${user.availability ? `<p><strong>Availability:</strong> <span class="availability-${user.availability}">${user.availability}</span></p>` : ''}
                    ${user.age ? `<p><strong>Age:</strong> ${user.age}</p>` : ''}
                    ${user.location ? `<p><strong>Location:</strong> ${escapeHtml(user.location)}${user.country ? ', ' + escapeHtml(user.country) : ''}</p>` : ''}
                    ${user.languages ? `<p><strong>Languages:</strong> ${escapeHtml(user.languages)}</p>` : ''}
                    ${user.experience_years ? `<p><strong>Experience:</strong> ${user.experience_years} years</p>` : ''}
                    
                    ${user.skills && user.skills.length > 0 ? `
                        <div class="skills-section">
                            <h4>Skills</h4>
                            <div class="skills-list">
                                ${user.skills.map(skill => `
                                    <span class="skill-badge skill-${skill.proficiency_level}">
                                        ${escapeHtml(skill.skill_name)} 
                                        <small>(${skill.proficiency_level})</small>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="social-links">
                        ${user.github_link ? `<a href="${escapeHtml(user.github_link)}" target="_blank" class="social-link">🔗 GitHub</a>` : ''}
                        ${user.linkedin_link ? `<a href="${escapeHtml(user.linkedin_link)}" target="_blank" class="social-link">🔗 LinkedIn</a>` : ''}
                        ${user.portfolio_link ? `<a href="${escapeHtml(user.portfolio_link)}" target="_blank" class="social-link">🔗 Portfolio</a>` : ''}
                        ${user.website ? `<a href="${escapeHtml(user.website)}" target="_blank" class="social-link">🌐 Website</a>` : ''}
                    </div>
                    
                    <p class="profile-joined"><strong>Member since:</strong> ${formatDate(user.created_at)}</p>
                </div>
            ` : '<p class="incomplete-msg">⚠️ Complete your profile to get more opportunities!</p>'}
        </div>
    `;
}

/**
 * Load notifications
 */
async function loadNotifications(userId) {
    try {
        const response = await fetch(`${API_URL}/auth/notifications/${userId}`);
        const data = await response.json();
        
        if (data.status === 'success') {
            const unreadCount = data.notifications.filter(n => !n.is_read).length;
            const badge = document.getElementById('notificationBadge');
            if (badge && unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline';
            }
        }
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

/**
 * Load unread message count
 */
async function loadUnreadMessageCount(userId) {
    // Placeholder for message count
    const badge = document.getElementById('unreadMessages');
    if (badge) {
        // This would connect to a messages API endpoint
        badge.textContent = '';
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    displayJobs();
    loadProfile();
    
    const currentUser = getCurrentUser();
    if (currentUser) {
        loadNotifications(currentUser.user_id);
    }
});
/**
 * Load freelancer's jobs (jobs they've applied to)
 */
async function loadFreelancerJobs(userId) {
    const myJobsSection = document.getElementById('myJobsList');
    if (!myJobsSection) return;

    try {
        const response = await fetch(`${API_URL}/jobs/all`);
        const data = await response.json();

        if (data.status === 'success') {
            // Filter jobs where user has proposals
            const jobsWithProposals = data.jobs.filter(job => job.total_proposals > 0);
            
            if (jobsWithProposals.length === 0) {
                myJobsSection.innerHTML = '<p class="empty-state">You haven\'t applied to any jobs yet.</p>';
                return;
            }

            myJobsSection.innerHTML = '';
            jobsWithProposals.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                jobCard.innerHTML = `
                    <h4>${escapeHtml(job.title)}</h4>
                    <p>${escapeHtml(job.description)}</p>
                    <p><strong>Status:</strong> ${job.status}</p>
                    <button onclick="viewJobDetails(${job.job_id})" class="btn btn-secondary">View Details</button>
                `;
                myJobsSection.appendChild(jobCard);
            });
        }
    } catch (error) {
        console.error('Error loading freelancer jobs:', error);
        myJobsSection.innerHTML = '<p class="error-message">Failed to load jobs</p>';
    }
}

/**
 * Load client's posted jobs
 */
async function loadClientJobs(userId) {
    const myJobsSection = document.getElementById('myJobsList');
    if (!myJobsSection) return;

    try {
        const response = await fetch(`${API_URL}/jobs/all`);
        const data = await response.json();

        if (data.status === 'success') {
            // Filter jobs posted by this client
            const myJobs = data.jobs.filter(job => job.client_id === userId);
            
            if (myJobs.length === 0) {
                myJobsSection.innerHTML = '<p class="empty-state">You haven\'t posted any jobs yet.</p>';
                return;
            }

            myJobsSection.innerHTML = '';
            myJobs.forEach(job => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                const statusClass = getStatusClass(job.status);
                
                jobCard.innerHTML = `
                    <div class="job-header">
                        <h4>${escapeHtml(job.title)}</h4>
                        <span class="badge ${statusClass}">${job.status.toUpperCase()}</span>
                    </div>
                    <p>${escapeHtml(job.description)}</p>
                    <p><strong>Proposals:</strong> ${job.total_proposals || 0}</p>
                    <p><strong>Posted:</strong> ${formatDate(job.created_at)}</p>
                    <div class="job-actions">
                        <button onclick="viewJobDetails(${job.job_id})" class="btn btn-secondary">View Details</button>
                        <button onclick="deleteJob(${job.job_id})" class="btn btn-danger">Delete</button>
                    </div>
                `;
                myJobsSection.appendChild(jobCard);
            });
        }
    } catch (error) {
        console.error('Error loading client jobs:', error);
        myJobsSection.innerHTML = '<p class="error-message">Failed to load jobs</p>';
    }
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    displayJobs();
    loadProfile();
    
    const currentUser = getCurrentUser();
    if (currentUser) {
        loadNotifications(currentUser.user_id);
    }
});
// Add these functions to script.js for complete profile functionality

/**
 * Open Edit Profile Modal
 */
function openEditModal() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    // Load current profile data
    fetch(`${API_URL}/auth/profile/${currentUser.user_id}`)
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                const user = data.user;
                
                // Populate form fields
                document.getElementById('editName').value = user.name || '';
                document.getElementById('editPhone').value = user.phone || '';
                document.getElementById('editAge').value = user.age || '';
                document.getElementById('editBio').value = user.bio || '';
                document.getElementById('editTitle').value = user.title || '';
                document.getElementById('editHourlyRate').value = user.hourly_rate || '';
                document.getElementById('editLocation').value = user.location || '';
                document.getElementById('editCountry').value = user.country || '';
                document.getElementById('editLanguages').value = user.languages || '';
                document.getElementById('editGithub').value = user.github_link || '';
                document.getElementById('editLinkedin').value = user.linkedin_link || '';
                document.getElementById('editPortfolio').value = user.portfolio_link || '';
                document.getElementById('editWebsite').value = user.website || '';
                document.getElementById('editAvailability').value = user.availability || 'available';
                document.getElementById('editExperience').value = user.experience_years || '';
                
                // Show modal
                document.getElementById('editModal').style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error loading profile:', error);
            alert('Failed to load profile data');
        });
}

/**
 * Close Edit Profile Modal
 */
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

/**
 * Save Profile - Enhanced
 */
async function saveProfile() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        return alert('Please login first!');
    }

    const name = document.getElementById('editName').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const age = document.getElementById('editAge').value;
    const bio = document.getElementById('editBio').value.trim();
    const title = document.getElementById('editTitle').value.trim();
    const hourlyRate = document.getElementById('editHourlyRate').value;
    const location = document.getElementById('editLocation').value.trim();
    const country = document.getElementById('editCountry').value.trim();
    const languages = document.getElementById('editLanguages').value.trim();
    const github_link = document.getElementById('editGithub').value.trim();
    const linkedin_link = document.getElementById('editLinkedin').value.trim();
    const portfolio_link = document.getElementById('editPortfolio').value.trim();
    const website = document.getElementById('editWebsite').value.trim();
    const availability = document.getElementById('editAvailability').value;
    const experience_years = document.getElementById('editExperience').value;

    if (!name) {
        return alert('Name is required!');
    }

    try {
        const response = await fetch(`${API_URL}/auth/profile/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.user_id,
                name, phone, age, bio, title, hourly_rate: hourlyRate,
                location, country, languages, github_link, linkedin_link,
                portfolio_link, website, availability, experience_years
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            alert('✅ Profile updated successfully!');
            
            // Update current user name in localStorage
            currentUser.name = name;
            setCurrentUser(currentUser);
            
            closeEditModal();
            loadProfile(); // Reload profile display
            updateNavigation(); // Update navigation with new name
        } else {
            alert('❌ ' + (data.message || 'Failed to update profile'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('❌ Server error!');
    }
}

/**
 * Load and display user profile - Enhanced
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
        profileSection.innerHTML = '<p class="error-message">Error loading profile.</p>';
    }
}

/**
 * Display profile data - Enhanced
 */
function displayProfileData(user) {
    const profileSection = document.getElementById('profileSection');
    
    const ratingStars = user.avg_rating 
        ? '⭐'.repeat(Math.round(user.avg_rating))
        : 'No ratings yet';
    
    profileSection.innerHTML = `
        <div class="profile-card">
            <div class="profile-header">
                <div class="profile-avatar-large">
                    ${user.profile_picture 
                        ? `<img src="${escapeHtml(user.profile_picture)}" alt="Profile">` 
                        : user.name.charAt(0).toUpperCase()}
                </div>
                <div class="profile-info">
                    <h2>${escapeHtml(user.name)} ${user.is_verified ? '<span class="verified-badge">✓</span>' : ''}</h2>
                    ${user.title ? `<p class="profile-title">${escapeHtml(user.title)}</p>` : ''}
                    <p class="profile-role">${user.role.toUpperCase()}</p>
                    <p class="profile-email">${escapeHtml(user.email)}</p>
                    ${user.phone ? `<p class="profile-phone">📞 ${escapeHtml(user.phone)}</p>` : ''}
                </div>
                <button class="btn btn-primary" onclick="openEditModal()">
                    ${user.profile_completed ? 'Edit Profile' : 'Complete Profile'}
                </button>
            </div>
            
            ${user.profile_completed ? `
                <div class="profile-stats">
                    <div class="stat-card">
                        <h4>${user.total_jobs_completed || 0}</h4>
                        <p>Jobs Completed</p>
                    </div>
                    <div class="stat-card">
                        <h4>${formatCurrency(user.total_earnings || 0)}</h4>
                        <p>Total Earnings</p>
                    </div>
                    <div class="stat-card">
                        <h4>${user.success_rate || 0}%</h4>
                        <p>Success Rate</p>
                    </div>
                    <div class="stat-card">
                        <h4>${ratingStars}</h4>
                        <p>${user.total_reviews || 0} Reviews</p>
                    </div>
                </div>
                
                <div class="profile-details">
                    ${user.bio ? `<div class="detail-section"><h4>About</h4><p>${escapeHtml(user.bio)}</p></div>` : ''}
                    
                    <div class="detail-grid">
                        ${user.hourly_rate ? `<p><strong>Hourly Rate:</strong> ${formatCurrency(user.hourly_rate)}/hr</p>` : ''}
                        ${user.availability ? `<p><strong>Availability:</strong> <span class="availability-${user.availability}">${user.availability}</span></p>` : ''}
                        ${user.age ? `<p><strong>Age:</strong> ${user.age}</p>` : ''}
                        ${user.location ? `<p><strong>Location:</strong> ${escapeHtml(user.location)}${user.country ? ', ' + escapeHtml(user.country) : ''}</p>` : ''}
                        ${user.languages ? `<p><strong>Languages:</strong> ${escapeHtml(user.languages)}</p>` : ''}
                        ${user.experience_years ? `<p><strong>Experience:</strong> ${user.experience_years} years</p>` : ''}
                    </div>
                    
                    ${user.skills && user.skills.length > 0 ? `
                        <div class="skills-section">
                            <h4>Skills</h4>
                            <div class="skills-list">
                                ${user.skills.map(skill => `
                                    <span class="skill-badge skill-${skill.proficiency_level}">
                                        ${escapeHtml(skill.skill_name)} 
                                        <small>(${skill.proficiency_level})</small>
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="social-links">
                        ${user.github_link ? `<a href="${escapeHtml(user.github_link)}" target="_blank" class="social-link">🔗 GitHub</a>` : ''}
                        ${user.linkedin_link ? `<a href="${escapeHtml(user.linkedin_link)}" target="_blank" class="social-link">🔗 LinkedIn</a>` : ''}
                        ${user.portfolio_link ? `<a href="${escapeHtml(user.portfolio_link)}" target="_blank" class="social-link">🔗 Portfolio</a>` : ''}
                        ${user.website ? `<a href="${escapeHtml(user.website)}" target="_blank" class="social-link">🌐 Website</a>` : ''}
                    </div>
                    
                    <p class="profile-joined"><strong>Member since:</strong> ${formatDate(user.created_at)}</p>
                </div>
            ` : '<p class="incomplete-msg">⚠️ Complete your profile to get more opportunities!</p>'}
        </div>
    `;
}

/**
 * Load freelancer's jobs (jobs they've applied to)
 */
async function loadFreelancerJobs(userId) {
    const myJobsSection = document.getElementById('myJobsList');
    if (!myJobsSection) return;

    try {
        const response = await fetch(`${API_URL}/jobs/proposals/my/${userId}`);
        const data = await response.json();

        if (data.status === 'success' && data.proposals.length > 0) {
            myJobsSection.innerHTML = '<h3>My Applied Jobs</h3>';
            
            data.proposals.forEach(proposal => {
                const jobCard = document.createElement('div');
                jobCard.className = 'job-card';
                const statusClass = getStatusClass(proposal.status);
                
                jobCard.innerHTML = `
                    <div class="job-header">
                        <h4>${escapeHtml(proposal.job_title)}</h4>
                        <span class="badge ${statusClass}">${proposal.status.toUpperCase()}</span>
                    </div>
                    <p>${escapeHtml(proposal.job_description.substring(0, 150))}...</p>
                    <p><strong>Proposed Budget:</strong> ${formatCurrency(proposal.proposed_budget)}</p>
                    <p><strong>Applied:</strong> ${formatDate(proposal.submitted_at)}</p>
                    <div class="job-actions">
                        <button onclick="window.location.href='job-details.html?id=${proposal.job_id}'" class="btn btn-secondary">View Job</button>
                    </div>
                `;
                myJobsSection.appendChild(jobCard);
            });
        } else {
            myJobsSection.innerHTML = '<p class="empty-state">You haven\'t applied to any jobs yet.</p>';
        }
    } catch (error) {
        console.error('Error loading freelancer jobs:', error);
        myJobsSection.innerHTML = '<p class="error-message">Failed to load jobs</p>';
    }
}

/**
 * Load client's posted jobs
 */
async function loadClientJobs(userId) {
    const myJobsSection = document.getElementById('myJobsList');
    if (!myJobsSection) return;

    try {
        const response = await fetch(`${API_URL}/jobs/all`);
        const data = await response.json();

        if (data.status === 'success') {
            // Filter jobs posted by this client
            const myJobs = data.jobs.filter(job => job.client_id === userId);
            
            if (myJobs.length > 0) {
                myJobsSection.innerHTML = '<h3>My Posted Jobs</h3>';
                
                myJobs.forEach(job => {
                    const jobCard = document.createElement('div');
                    jobCard.className = 'job-card';
                    const statusClass = getStatusClass(job.status);
                    
                    jobCard.innerHTML = `
                        <div class="job-header">
                            <h4>${escapeHtml(job.title)}</h4>
                            <span class="badge ${statusClass}">${job.status.toUpperCase()}</span>
                        </div>
                        <p>${escapeHtml(job.description.substring(0, 150))}...</p>
                        <p><strong>Proposals:</strong> ${job.total_proposals || 0}</p>
                        <p><strong>Posted:</strong> ${formatDate(job.created_at)}</p>
                        <div class="job-actions">
                            <button onclick="window.location.href='job-details.html?id=${job.job_id}'" class="btn btn-secondary">View Details</button>
                            <button onclick="window.location.href='proposals.html?job_id=${job.job_id}'" class="btn btn-info">View Proposals (${job.total_proposals || 0})</button>
                            <button onclick="deleteJob(${job.job_id})" class="btn btn-danger">Delete</button>
                        </div>
                    `;
                    myJobsSection.appendChild(jobCard);
                });
            } else {
                myJobsSection.innerHTML = '<p class="empty-state">You haven\'t posted any jobs yet.</p>';
            }
        }
    } catch (error) {
        console.error('Error loading client jobs:', error);
        myJobsSection.innerHTML = '<p class="error-message">Failed to load jobs</p>';
    }
}
// PROPOSAL SUBMIT (job-details.html mein use hoga)
async function submitProposal() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== 'freelancer') {
        alert("Login as freelancer!");
        return;
    }

    const jobId = document.getElementById('proposalJobId').value;
    const cover = document.getElementById('proposalCoverLetter').value.trim();
    const budget = document.getElementById('proposalBudget').value;
    const duration = document.getElementById('proposalDuration').value.trim();

    if (!cover || !budget) return alert("Cover letter and budget required!");

    try {
        const res = await fetch(`${API_URL}/jobs/proposal/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_id: jobId,
                freelancer_id: currentUser.user_id,
                cover_letter: cover,
                proposed_budget: budget,
                duration
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            alert("Proposal submitted!");
            closeProposalModal();
            loadJobDetails(); // refresh
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Server error");
    }
}

// ACCEPT PROPOSAL (proposals.html mein use hoga)
async function acceptProposal(proposalId, jobId, freelancerId) {
    if (!confirm("Hire this freelancer?")) return;

    try {
        const res = await fetch(`${API_URL}/jobs/proposal/accept`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proposal_id: proposalId, job_id: jobId, freelancer_id: freelancerId })
        });

        const data = await res.json();
        if (data.status === 'success') {
            alert("Freelancer hired!");
            location.reload();
        } else {
            alert(data.message);
        }
    } catch (err) {
        alert("Error");
    }
}