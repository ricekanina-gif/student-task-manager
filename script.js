const CONFIG = {
  STORAGE_KEY: 'student-tasks',
  THEME_KEY: 'student-tasks-theme',
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  PRIORITY_ORDER: { High: 1, Medium: 2, Low: 3 },
  NOTIFICATION_INTERVAL: 30 * 60 * 1000 // 30 minutes
};

let tasks = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || [];
let selectedImageBase64 = null;
let notificationInterval = null;
let lastNotificationTime = 0;
let isPageFocused = true;
let notificationCount = 0;
let originalTitle = document.title;

const taskForm = document.getElementById('taskForm');
const taskList = document.getElementById('taskList');
const taskTitleInput = document.getElementById('taskTitle');
const courseInput = document.getElementById('course');
const dueDateInput = document.getElementById('dueDate');
const priorityInput = document.getElementById('priority');
const filterInput = document.getElementById('filterInput');
const taskCountSpan = document.getElementById('taskCount');
const themeToggle = document.getElementById('themeToggle');
const taskImageInput = document.getElementById('taskImage');
const imagePreview = document.getElementById('imagePreview');

const activeTasks = document.getElementById('activeTasks');
const completedTasks = document.getElementById('completedTasks');
const overdueTasks = document.getElementById('overdueTasks');
const totalTasks = document.getElementById('totalTasks');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');

const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeBtn = document.querySelector('.close');
const notificationModal = document.getElementById('notificationModal');
const notifCloseBtn = document.querySelector('.notif-close');

dueDateInput.min = new Date().toLocaleDateString('en-CA');
initTheme();
setupAltTabDetection();
startNotificationReminder();
renderTasks();

// ===== ALT+TAB DETECTION =====
function setupAltTabDetection() {
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      isPageFocused = false;
      console.log('🔴 You switched away from the page');
    } else {
      isPageFocused = true;
      console.log('🟢 You returned to the page');
      // Show notification again when returning
      const activeTasks = tasks.filter(t => !t.completed);
      if (activeTasks.length > 0) {
        showNotificationModal(activeTasks);
        playNotificationSound();
      }
    }
  });

  window.addEventListener('focus', function() {
    isPageFocused = true;
  });

  window.addEventListener('blur', function() {
    isPageFocused = false;
  });

  // Change page title when switched away
  setInterval(function() {
    if (!isPageFocused && notificationCount > 0) {
      document.title = `⏰ ${notificationCount} Tasks Waiting! - ${originalTitle}`;
    } else {
      document.title = originalTitle;
    }
  }, 1000);
}

// ===== SOUND NOTIFICATION =====
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Create a pleasant beep sound
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    console.log('🔊 Sound played!');
  } catch (e) {
    console.log('Audio not available on this device');
  }
}

// ===== EMAIL NOTIFICATION =====
function sendEmailNotification(tasks) {
  const taskList = tasks.slice(0, 5).map(task => {
    const daysLeft = daysUntilDue(task.dueDate);
    return `- ${task.title} (${task.course}) - Due: ${formatNiceDate(task.dueDate)}`;
  }).join('\n');

  const emailBody = `📋 TASK REMINDER ALERT!

You have ${tasks.length} pending tasks:

${taskList}

${tasks.length > 5 ? `\n... and ${tasks.length - 5} more tasks` : ''}

⏰ Please complete your tasks on time!

Visit your Task Manager to view all tasks.`;

  const mailtoLink = `mailto:?subject=📋 Task Reminder Alert&body=${encodeURIComponent(emailBody)}`;
  
  return {
    subject: '📋 Task Reminder Alert',
    body: emailBody,
    mailtoLink: mailtoLink
  };
}

window.sendEmail = function() {
  const activeTasks = tasks.filter(t => !t.completed);
  if (activeTasks.length > 0) {
    const emailData = sendEmailNotification(activeTasks);
    window.location.href = emailData.mailtoLink;
  }
};

function initTheme() {
  const savedTheme = localStorage.getItem(CONFIG.THEME_KEY);
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️ Light';
  }
}

window.toggleTheme = function() {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem(CONFIG.THEME_KEY, isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '☀️ Light' : '🌙 Dark';
};

function startNotificationReminder() {
  if (notificationInterval) clearInterval(notificationInterval);
  
  notificationInterval = setInterval(() => {
    const activeTasks = tasks.filter(t => !t.completed);
    if (activeTasks.length > 0) {
      notificationCount = activeTasks.length;
      showNotificationModal(activeTasks);
      playNotificationSound(); // 🔊 PLAY SOUND
    }
  }, CONFIG.NOTIFICATION_INTERVAL);
}

function showNotificationModal(activeTasks) {
  const pendingCount = activeTasks.length;
  document.getElementById('pendingTaskCount').textContent = pendingCount;
  
  const tasksList = document.getElementById('notificationTasksList');
  tasksList.innerHTML = activeTasks
    .slice(0, 5)
    .map(task => {
      const daysLeft = daysUntilDue(task.dueDate);
      const priorityClass = task.priority.toLowerCase().replace(/\s/g, '') + '-priority';
      
      let dueDateText = '';
      if (daysLeft === 0) dueDateText = 'Due today!';
      else if (daysLeft === 1) dueDateText = 'Due tomorrow';
      else if (daysLeft > 1) dueDateText = `Due in ${daysLeft} days`;
      else dueDateText = `${Math.abs(daysLeft)} days overdue!`;
      
      return `
        <div class="notification-task-item ${priorityClass}">
          <span class="notification-task-title">${escapeHtml(task.title)}</span>
          <span class="notification-task-course">${escapeHtml(task.course)}</span>
          <span class="notification-task-duedate">${dueDateText}</span>
        </div>
      `;
    })
    .join('');
  
  if (activeTasks.length > 5) {
    tasksList.innerHTML += `
      <div style="text-align: center; color: rgba(255,255,255,0.8); padding: 0.5rem; font-size: 0.9rem;">
        +${activeTasks.length - 5} more tasks
      </div>
    `;
  }
  
  notificationModal.classList.add('show');
}

function closeNotification() {
  notificationModal.classList.remove('show');
  notificationCount = 0;
}

function focusOnTasks() {
  closeNotification();
  const taskSection = document.querySelector('h2:nth-of-type(3)');
  if (taskSection) {
    taskSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function formatNiceDate(isoDate) {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '[Invalid Date]';
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function daysUntilDue(isoDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  return diff;
}

function getDaysUrgencyClass(daysLeft) {
  return daysLeft <= 3 ? 'urgent' : '';
}

function isValidDate(isoDate, minDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(isoDate)) return false;

  const dateObj = new Date(isoDate);
  if (isNaN(dateObj.getTime())) return false;
  if (dateObj.getFullYear() < CONFIG.MIN_YEAR || dateObj.getFullYear() > CONFIG.MAX_YEAR) return false;
  if (isoDate < minDate) return false;

  return true;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function updateStatistics() {
  const active = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  const overdue = tasks.filter(t => !t.completed && daysUntilDue(t.dueDate) < 0).length;
  const total = tasks.length;

  activeTasks.textContent = active;
  completedTasks.textContent = completed;
  overdueTasks.textContent = overdue;
  totalTasks.textContent = total;

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  progressPercent.textContent = percent;
  progressFill.style.width = percent + '%';
}

taskImageInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      selectedImageBase64 = event.target.result;
      imagePreview.innerHTML = `<img src="${selectedImageBase64}" alt="preview">`;
      imagePreview.classList.add('active');
    };
    reader.readAsDataURL(file);
  }
});

function openImageModal(imageSrc) {
  modal.classList.add('show');
  modalImage.src = imageSrc;
}

function closeImageModal() {
  modal.classList.remove('show');
}

closeBtn.addEventListener('click', closeImageModal);
notifCloseBtn.addEventListener('click', closeNotification);

modal.addEventListener('click', function(event) {
  if (event.target === modal) {
    closeImageModal();
  }
});

notificationModal.addEventListener('click', function(event) {
  if (event.target === notificationModal) {
    closeNotification();
  }
});

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeImageModal();
    closeNotification();
  }
});

function renderTasks() {
  let sorted = tasks.slice();
  sorted.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed - b.completed;
    if (a.completed) return 0;
    if (CONFIG.PRIORITY_ORDER[a.priority] !== CONFIG.PRIORITY_ORDER[b.priority]) {
      return CONFIG.PRIORITY_ORDER[a.priority] - CONFIG.PRIORITY_ORDER[b.priority];
    }
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const activeCount = tasks.filter(t => !t.completed).length;
  taskCountSpan.textContent = activeCount;

  taskList.innerHTML = sorted.length ? sorted.map((task) => {
    const originalIdx = tasks.indexOf(task);
    const daysLeft = daysUntilDue(task.dueDate);
    const urgencyClass = getDaysUrgencyClass(daysLeft);
    
    let daysText = '';
    if (daysLeft === 0) {
      daysText = 'Due today';
    } else if (daysLeft === 1) {
      daysText = '1 day left';
    } else if (daysLeft > 1) {
      daysText = `${daysLeft} days left`;
    } else {
      daysText = `${Math.abs(daysLeft)} days overdue`;
    }
    
    const imageDisplay = task.image ? `<div class="task-image-container" onclick="openImageModal('${task.image}')"><img src="${task.image}" alt="task"></div>` : '';
    
    return `
      <li class="${task.completed ? 'completed' : ''}">
        <div class="task-details">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <div class="task-meta">
            ${escapeHtml(task.course)} | Due: ${formatNiceDate(task.dueDate)} | 
            <span class="days-left ${urgencyClass}">${daysText}</span> | 
            <span class="priority-${task.priority}">${task.priority}</span>
          </div>
        </div>
        ${imageDisplay}
        <div class="task-buttons">
          <button class="complete-btn" onclick="toggleComplete(${originalIdx})">
            ${task.completed ? 'Undo' : 'Complete'}
          </button>
          <button class="complete-btn delete" onclick="removeTask(${originalIdx})">
            Delete
          </button>
        </div>
      </li>
    `;
  }).join('') : `<li style="text-align: center; color: #afbeea;">No tasks added yet.</li>`;

  updateStatistics();
}

taskForm.addEventListener('submit', function(e) {
  e.preventDefault();
  
  const title = taskTitleInput.value.trim();
  const course = courseInput.value.trim();
  const dueDate = dueDateInput.value;
  const priority = priorityInput.value;

  if (!title || !course || !dueDate || !priority) {
    alert("Please fill in all required fields.");
    return;
  }

  if (!isValidDate(dueDate, dueDateInput.min)) {
    alert("Please pick a valid, realistic date using the date picker.");
    return;
  }

  tasks.push({ 
    title, course,
    dueDate,
    priority, 
    image: selectedImageBase64,
    completed: false,
    createdAt: new Date().toISOString()
  });

  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(tasks));
  renderTasks();
  taskForm.reset();
  priorityInput.selectedIndex = 0;
  selectedImageBase64 = null;
  imagePreview.classList.remove('active');
  imagePreview.innerHTML = '';
  taskTitleInput.focus();
});

filterInput.addEventListener('input', function(e) {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.task-list li').forEach(li => {
    if (li.textContent.toLowerCase().includes(query)) {
      li.style.display = '';
    } else {
      li.style.display = 'none';
    }
  });
});

themeToggle.addEventListener('click', toggleTheme);

window.toggleComplete = function(idx) {
  if (idx >= 0 && idx < tasks.length) {
    tasks[idx].completed = !tasks[idx].completed;
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(tasks));
    renderTasks();
  }
};

window.removeTask = function(idx) {
  if (idx >= 0 && idx < tasks.length) {
    tasks.splice(idx, 1);
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(tasks));
    renderTasks();
  }
};

window.clearCompleted = function() {
  tasks = tasks.filter(t => !t.completed);
  localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(tasks));
  renderTasks();
};

window.closeNotification = closeNotification;
window.focusOnTasks = focusOnTasks;
