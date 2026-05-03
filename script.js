const CONFIG = {
  STORAGE_KEY: 'student-tasks',
  THEME_KEY: 'student-tasks-theme',
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  PRIORITY_ORDER: { High: 1, Medium: 2, Low: 3 }
};

let tasks = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEY)) || [];
let selectedImageBase64 = null;

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

// Modal elements
const modal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeBtn = document.querySelector('.close');

dueDateInput.min = new Date().toLocaleDateString('en-CA');
initTheme();
renderTasks();

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

// Modal functions
function openImageModal(imageSrc) {
  modal.classList.add('show');
  modalImage.src = imageSrc;
}

function closeImageModal() {
  modal.classList.remove('show');
}

closeBtn.addEventListener('click', closeImageModal);

modal.addEventListener('click', function(event) {
  if (event.target === modal) {
    closeImageModal();
  }
});

// Keyboard support
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    closeImageModal();
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