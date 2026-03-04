// State Management
const state = {
    termStartDate: new Date('2024-02-26'), // Default start date
    currentWeek: 1,
    selectedWeek: 1,
    showWeekends: false
};

// Helper: Calculate Current Week
function calculateCurrentWeek() {
    const now = new Date();
    const start = new Date(state.termStartDate);
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    state.currentWeek = Math.ceil(diffDays / 7);
    // If future or way past, default to 1
    if (state.currentWeek < 1) state.currentWeek = 1;
    if (state.currentWeek > 20) state.currentWeek = 1; // Assuming 20 weeks max
    return state.currentWeek;
}

// --- UI Utilities ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Auto remove after 3s
    setTimeout(() => {
        toast.style.animation = 'slideDownFade 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Helper: Copy to Clipboard
function copyToClipboard(text, description = "Details") {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${description} copied!`, 'success');
    }).catch(err => {
        showToast(`Failed to copy ${description}`, 'error');
        console.error('Copy failed:', err);
    });
}

// Helper: Check if course is active in a given week
function isCourseActive(course, week) {
    if (!course.weeks) return true;
    if (week === 'all') return true;
    
    // Parse "1-16", "1-8, 10-16", "3,5,7"
    const parts = course.weeks.split(',');
    for (let part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (week >= start && week <= end) return true;
        } else {
            if (parseInt(part) === week) return true;
        }
    }
    return false;
}

// Sample Course Data (Replace with real data or fetch logic)
let courseData = [];

// --- Data Layer ---
async function loadCourseData() {
    // Simulate API request/cache logic
    const cachedData = localStorage.getItem('cachedCourseData');
    
    // Show spinner if needed (UI)
    // Actually we will render a skeleton or spinner in renderFullSchedule first.
    
    // Fallback: If no API, use local sample data or cache
    if (cachedData) {
        courseData = JSON.parse(cachedData);
        showToast('Loaded course data from cache', 'success');
        return;
    }
    
    // Simulate Fetch (replace with real fetch later)
    return new Promise(resolve => {
        setTimeout(() => {
            // Simulate Success
            courseData = [
                { id: 1, name: "Data Structures", day: "Mon", start: "09:00", end: "10:30", location: "Room 101", teacher: "Prof. Smith", weeks: "1-16" },
                { id: 2, name: "Calculus II", day: "Mon", start: "11:00", end: "12:30", location: "Room 202", teacher: "Dr. Johnson", weeks: "1-16" },
                { id: 3, name: "Physics Lab", day: "Tue", start: "14:00", end: "16:00", location: "Lab 3", teacher: "Dr. Tesla", weeks: "1-8" },
                { id: 4, name: "Algorithms", day: "Wed", start: "10:00", end: "11:30", location: "Room 105", teacher: "Prof. Knuth", weeks: "1-16" },
                { id: 5, name: "Data Structures", day: "Wed", start: "13:00", end: "14:30", location: "Room 101", teacher: "Prof. Smith", weeks: "1-16" },
                { id: 6, name: "History of Tech", day: "Thu", start: "09:00", end: "10:30", location: "Auditorium A", teacher: "Mr. History", weeks: "1-16" },
                { id: 7, name: "Calculus II", day: "Fri", start: "11:00", end: "12:30", location: "Room 202", teacher: "Dr. Johnson", weeks: "1-16" },
                { id: 8, name: "Web Development", day: "Fri", start: "14:00", end: "15:30", location: "Comp Lab 1", teacher: "Ms. Coder", weeks: "1-16" },
                // Conflict Test Cases
                { id: 9, name: "Intro to AI", day: "Mon", start: "09:00", end: "10:30", location: "Room 303", teacher: "Dr. Bot", weeks: "1-16" },
                { id: 10, name: "Morning Yoga", day: "Mon", start: "09:00", end: "10:00", location: "Gym", teacher: "Instructor Zen", weeks: "1-16" }
            ];
            
            // Cache it
            localStorage.setItem('cachedCourseData', JSON.stringify(courseData));
            showToast('Course data refreshed', 'success');
            resolve();
        }, 500); // 500ms fake delay
    });
}


// Helper: Get Day Name from Index (0=Sun, 1=Mon...)
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ICONS = {
    location: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    teacher: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    weeks: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`
};

// Color Hash Function (Golden Angle Approximation)
function getCourseColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Use Golden Angle (approx 137.5 degrees) to distribute hues
    const goldenAngle = 137.508;
    const h = (Math.abs(hash) * goldenAngle) % 360;
    
    const s = 65; // Slightly lower saturation for pastel feel
    const l = 55; // Slightly higher lightness
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Render Course Card HTML
function renderCourseCard(course, color) {
    return `
        <div class="course-header">
            <div class="course-name" style="color:${color}">${course.name}</div>
        </div>
        <div class="course-body">
            <div class="meta-row" title="Location">
                <span class="icon">${ICONS.location}</span>
                <span>${course.location}</span>
            </div>
            <div class="meta-row" title="Teacher">
                <span class="icon">${ICONS.teacher}</span>
                <span>${course.teacher || 'Staff'}</span>
            </div>
            <div class="meta-row" title="Weeks">
                <span class="icon">${ICONS.weeks}</span>
                <span>${course.weeks || '1-16'}</span>
            </div>
        </div>
    `;
}

// Render Today's Schedule
function renderTodaySchedule() {
    const today = new Date();
    const dayName = days[today.getDay()];
    // const dayName = "Mon"; // Debug: Force Monday for testing
    
    document.getElementById('current-date').textContent = `(${dayName}, ${today.toLocaleDateString()})`;

    const todayGrid = document.getElementById('today-grid');
    todayGrid.innerHTML = ''; // Clear existing content

    const todaysCourses = courseData.filter(c => {
        // 1. Match Day
        if (c.day !== dayName) return false;
        // 2. Match Current Week
        return isCourseActive(c, state.currentWeek);
    }).sort((a, b) => {
        return a.start.localeCompare(b.start);
    });

    if (todaysCourses.length === 0) {
        todayGrid.innerHTML = '<div class="empty-state">No classes scheduled for today! Enjoy your free time.</div>';
        return;
    }

    todaysCourses.forEach(course => {
        const color = getCourseColor(course.name);
        const card = document.createElement('div');
        card.className = 'today-course-card';
        card.style.borderLeft = `5px solid ${color}`;
        
        // Use new render helper
        card.innerHTML = renderCourseCard(course, color);
        
        // Add time separately or integrated? 
        // The original had time. The new requirement "Name (primary) -> Location -> Teacher -> Weeks" 
        // doesn't explicitly mention Time, but it's crucial. I'll add it at the top or bottom.
        // Let's prepend it to the header or body.
        
        // Re-inject time for context
        const timeDiv = document.createElement('div');
        timeDiv.className = 'time-badge';
        timeDiv.style.backgroundColor = color;
        timeDiv.style.color = '#fff';
        timeDiv.textContent = `${course.start} - ${course.end}`;
        card.insertBefore(timeDiv, card.firstChild);

        todayGrid.appendChild(card);
    });
}

// Render Full Weekly Schedule
async function renderFullSchedule(selectedWeek = 'all') {
    const scheduleGrid = document.querySelector('.schedule-grid');
    scheduleGrid.innerHTML = ''; // Clear everything

    // Add Loading Overlay
    const loader = document.createElement('div');
    loader.className = 'loading-overlay';
    loader.innerHTML = '<div class="spinner"></div>';
    scheduleGrid.appendChild(loader);
    
    // Ensure data is loaded
    if (courseData.length === 0) {
        await loadCourseData();
    }
    
    // Remove loader
    loader.remove();

    // Rebuild Headers
    const headers = ["Time", "Mon", "Tue", "Wed", "Thu", "Fri"];
    if (state.showWeekends) {
        headers.push("Sat", "Sun");
    }
    
    // Update Week Selector Visual
    const weekSelect = document.getElementById('week-select');
    weekSelect.value = selectedWeek;
    document.getElementById('current-week-label').textContent = selectedWeek === 'all' ? 'All Weeks' : `Week ${selectedWeek}`;

    headers.forEach(text => {
        const div = document.createElement('div');
        div.className = 'header-cell';
        div.textContent = text;
        scheduleGrid.appendChild(div);
    });
    
    // Time slots (e.g., 8:00 to 18:00)
    const startHour = 8;
    const endHour = 18;
    const todayIndex = new Date().getDay(); // 0-6
    
    // Create grid rows for each hour
    for (let h = startHour; h < endHour; h++) {
        // Time Label Column
        const timeCell = document.createElement('div');
        timeCell.className = 'header-cell time-label';
        timeCell.textContent = `${h}:00`;
        scheduleGrid.appendChild(timeCell);

        // Day Columns (Mon-Fri + Weekend?)
        const daysToShow = state.showWeekends ? 7 : 5;
        for (let d = 1; d <= daysToShow; d++) {
            const dayIdx = d > 6 ? 0 : d; // Handle Sunday=0
            const dayName = days[dayIdx];
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            
            // Highlight today's column
            if (dayIdx === todayIndex) {
                cell.classList.add('today-highlight');
            }

            // Find ALL courses in this slot AND active this week
            const courses = courseData.filter(c => {
                const cStart = parseInt(c.start.split(':')[0]);
                // Filter by Day & Time
                const matchesTime = c.day === dayName && cStart === h;
                // Filter by Week
                const matchesWeek = isCourseActive(c, selectedWeek === 'all' ? 'all' : parseInt(selectedWeek));
                return matchesTime && matchesWeek;
            });

            if (courses.length > 0) {
                // Conflict Logic: Show Top 2, then +N button
                const visibleCourses = courses.slice(0, 2);
                const hiddenCount = courses.length - 2;

                visibleCourses.forEach(course => {
                    const color = getCourseColor(course.name);
                    const courseDiv = document.createElement('div');
                    courseDiv.className = 'course-cell';
                    courseDiv.style.backgroundColor = color;
                    
                    courseDiv.title = `${course.name}\n${course.location}\n${course.start}-${course.end}`;
                    
                    courseDiv.innerHTML = `
                        <div class="course-title">${course.name}</div>
                        <div class="details">${course.location}</div>
                    `;
                    
                    // Click to View Single Course
                    courseDiv.onclick = () => showCourseModal([course]);

                    cell.appendChild(courseDiv);
                });

                if (hiddenCount > 0) {
                    const moreBtn = document.createElement('div');
                    moreBtn.className = 'more-courses-btn';
                    moreBtn.textContent = `+${hiddenCount} 门课`; // Updated text per request
                    moreBtn.onclick = () => showCourseModal(courses);
                    cell.appendChild(moreBtn);
                }
            }

            scheduleGrid.appendChild(cell);
        }
    }
}

// Simple Modal Logic
function showCourseModal(courses) {
    const modalHtml = `
        <div id="course-modal-overlay" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;justify-content:center;align-items:center;z-index:1000;">
            <div style="background:white;padding:20px;border-radius:8px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="margin:0;">Course Details</h3>
                    <button onclick="document.getElementById('course-modal-overlay').remove()" style="background:none;border:none;font-size:1.5em;cursor:pointer;">&times;</button>
                </div>
                ${courses.map(c => {
                    const color = getCourseColor(c.name);
                    const fullText = `${c.name} at ${c.location} (${c.start}-${c.end})`;
                    return `
                        <div style="margin-bottom:15px;border-left:4px solid ${color};padding-left:10px;padding-top:2px;padding-bottom:2px;">
                            <div style="font-weight:bold;color:${color};display:flex;justify-content:space-between;">
                                <span>${c.name}</span>
                                <button class="copy-btn" onclick="copyToClipboard('${c.name}', 'Course Name')">Copy</button>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                                <span>${c.start} - ${c.end}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
                                <span>${c.location}</span>
                                <button class="copy-btn" onclick="copyToClipboard('${c.location}', 'Location')">Copy</button>
                            </div>
                            <div style="margin-top:4px;">${c.teacher || 'Staff'}</div>
                            <div style="font-size:0.85em;color:#666;margin-top:4px;">Weeks: ${c.weeks}</div>
                        </div>
                    `;
                }).join('')}
                <button onclick="document.getElementById('course-modal-overlay').remove()" style="margin-top:10px;width:100%;padding:10px;background:#f5f5f5;color:#333;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Close</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// --- Export & Import Features ---

// Helper: Parse weeks string to array of integers
function parseWeeks(weeksStr) {
    if (!weeksStr) return [];
    const weeks = new Set();
    const parts = weeksStr.split(',');
    for (let part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n));
            for (let i = start; i <= end; i++) weeks.add(i);
        } else {
            weeks.add(parseInt(part));
        }
    }
    return Array.from(weeks).sort((a, b) => a - b);
}

// Feature: Import JSON
function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            if (Array.isArray(json)) {
                // Basic validation: Check if first item has 'name' and 'start'
                if (json.length > 0 && (!json[0].name || !json[0].start)) {
                    alert('Invalid JSON format. Expected array of course objects.');
                    return;
                }
                courseData = json;
                // Re-render
                state.currentWeek = calculateCurrentWeek();
                state.selectedWeek = state.currentWeek;
                renderTodaySchedule();
                renderFullSchedule(state.selectedWeek);
                alert('Schedule imported successfully!');
            } else {
                alert('Invalid JSON: Root must be an array.');
            }
        } catch (err) {
            alert('Error parsing JSON file.');
            console.error(err);
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = ''; 
}

// Feature: Export Image (using html2canvas)
function exportImage() {
    const scheduleElement = document.getElementById('full-schedule');
    if (!scheduleElement) return;

    // Optional: Add a loading state
    const btn = document.getElementById('export-img-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Generating...';

    html2canvas(scheduleElement).then(canvas => {
        const link = document.createElement('a');
        link.download = `schedule_week_${state.selectedWeek}.png`;
        link.href = canvas.toDataURL();
        link.click();
        btn.textContent = originalText;
        showToast('Image exported successfully', 'success');
    }).catch(err => {
        console.error('Export failed:', err);
        showToast('Failed to export image', 'error');
        btn.textContent = originalText;
    });
}

// Feature: Export ICS
function exportICS() {
    let icsContent = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//My Static Course Schedule//EN",
        "CALSCALE:GREGORIAN"
    ];

    const termStart = new Date(state.termStartDate);
    
    // Day Index Map for Date Calculation
    // days array: ["Sun", "Mon", "Tue"...] -> Sun=0, Mon=1...
    // ICS needs accurate date.
    // termStart is expected to be Monday of Week 1.

    courseData.forEach(course => {
        const activeWeeks = parseWeeks(course.weeks || "1-16"); // Default 1-16 if missing
        
        // Correct Day Offset Calculation
        // days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        const dayIndex = days.indexOf(course.day); 
        if (dayIndex === -1) return;

        // Term Starts on MONDAY. 
        // If course is Mon (index 1), offset is 0.
        // If course is Sun (index 0), offset is 6.
        let dayOffsetFromMonday = (dayIndex + 6) % 7; 

        activeWeeks.forEach(week => {
            // Calculate Date for this specific class session
            // Date = TermStart + (Week-1)*7 + DayOffset
            // Create a NEW Date object for each iteration to avoid mutating termStart or accumulator
            const sessionDate = new Date(termStart.getTime()); // Clone termStart
            sessionDate.setDate(sessionDate.getDate() + (week - 1) * 7 + dayOffsetFromMonday);

            // Parse Start/End Time (HH:MM)
            const [startH, startM] = course.start.split(':').map(Number);
            const [endH, endM] = course.end.split(':').map(Number);

            // Format YYYYMMDDTHHMMSS
            const formatICSDate = (date, h, m) => {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hour = h.toString().padStart(2, '0');
                const minute = m.toString().padStart(2, '0');
                return `${year}${month}${day}T${hour}${minute}00`;
            };

            const dtStart = formatICSDate(sessionDate, startH, startM);
            const dtEnd = formatICSDate(sessionDate, endH, endM);
            const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

            icsContent.push("BEGIN:VEVENT");
            icsContent.push(`DTSTAMP:${now}`);
            icsContent.push(`UID:${dtStart}-${course.name.replace(/\s+/g, '')}@myschedule`);
            icsContent.push(`SUMMARY:${course.name}`);
            icsContent.push(`DTSTART:${dtStart}`);
            icsContent.push(`DTEND:${dtEnd}`);
            icsContent.push(`LOCATION:${course.location}`);
            icsContent.push(`DESCRIPTION:Teacher: ${course.teacher || 'N/A'}\\nWeek: ${week}`);
            icsContent.push("END:VEVENT");
        });
    });

    icsContent.push("END:VCALENDAR");

    // Download File
    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'course_schedule.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('ICS file exported successfully', 'success');
}


// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // 1. Calculate Current Week
    document.getElementById('term-start').value = state.termStartDate.toISOString().split('T')[0];
    state.currentWeek = calculateCurrentWeek();
    state.selectedWeek = state.currentWeek;

    // 2. Populate Week Selector
    const weekSelect = document.getElementById('week-select');
    for (let i = 1; i <= 20; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Week ${i}`;
        weekSelect.appendChild(opt);
    }
    weekSelect.value = state.selectedWeek;
    document.getElementById('current-week-label').textContent = `Week ${state.selectedWeek}`;

    // 3. Event Listeners
    
    // Import/Export
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', handleImport);
    document.getElementById('export-img-btn').addEventListener('click', exportImage);
    document.getElementById('export-ics-btn').addEventListener('click', exportICS);
    
    // Week Navigation
    document.getElementById('prev-week').addEventListener('click', () => {
        if (state.selectedWeek > 1) {
            state.selectedWeek--;
            renderFullSchedule(state.selectedWeek);
        }
    });

    document.getElementById('next-week').addEventListener('click', () => {
        if (state.selectedWeek < 20) {
            state.selectedWeek++;
            renderFullSchedule(state.selectedWeek);
        }
    });

    document.getElementById('reset-week').addEventListener('click', () => {
        state.selectedWeek = state.currentWeek;
        renderFullSchedule(state.selectedWeek);
    });

    document.getElementById('week-select').addEventListener('change', (e) => {
        state.selectedWeek = e.target.value === 'all' ? 'all' : parseInt(e.target.value);
        renderFullSchedule(state.selectedWeek);
    });

    // Settings
    document.getElementById('term-start').addEventListener('change', (e) => {
        state.termStartDate = new Date(e.target.value);
        state.currentWeek = calculateCurrentWeek();
        // If we were on "current week", update the view
        if (state.selectedWeek !== 'all') {
            state.selectedWeek = state.currentWeek;
            renderFullSchedule(state.selectedWeek);
        }
    });

    document.getElementById('show-weekends').addEventListener('change', (e) => {
        state.showWeekends = e.target.checked;
        // Update Grid Columns CSS
        const grid = document.querySelector('.schedule-grid');
        if (state.showWeekends) {
            grid.style.gridTemplateColumns = '80px repeat(7, 1fr)';
        } else {
            grid.style.gridTemplateColumns = '80px repeat(5, 1fr)';
        }
        renderFullSchedule(state.selectedWeek);
    });

    // 4. Initial Render
    renderTodaySchedule();
    renderFullSchedule(state.selectedWeek);
});
