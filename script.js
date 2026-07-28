const state = {
  schedule: null,
  directory: null,
  selectedStudent: null,
  monthCursor: null,
  selectedDate: null,
  subjectFilter: "all",
};

const els = {
  studentName: document.getElementById("student-name"),
  studentCode: document.getElementById("student-code"),
  studentSection: document.getElementById("student-section"),
  studentCourseCount: document.getElementById("student-course-count"),
  studentNextClass: document.getElementById("student-next-class"),
  switchPersonButton: document.getElementById("switch-person-button"),
  monthLabel: document.getElementById("month-label"),
  calendarHeading: document.getElementById("calendar-heading"),
  selectedDayHeading: document.getElementById("selected-day-heading"),
  timelineHeading: document.getElementById("timeline-heading"),
  calendarGrid: document.getElementById("calendar-grid"),
  dayStats: document.getElementById("day-stats"),
  timeline: document.getElementById("timeline"),
  subjectFilter: document.getElementById("subject-filter"),
  prevMonth: document.getElementById("prev-month"),
  nextMonth: document.getElementById("next-month"),
  todayButton: document.getElementById("today-button"),
  entryTemplate: document.getElementById("entry-template"),
};

function format24HourLabel(hour) {
  if (hour === 24) {
    return "24:00";
  }
  return `${hour.toString().padStart(2, "0")}:00`;
}

function monthKeyFromDate(isoDate) {
  return isoDate.slice(0, 7);
}

function parseMonthCursor(value) {
  const [year, month] = value.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function filteredEntries() {
  const studentEntries = window.SiteCommon.getEntriesForStudent(state.schedule, state.selectedStudent);
  if (state.subjectFilter === "all") {
    return studentEntries;
  }
  return studentEntries.filter((entry) => entry.subject && String(entry.subject.id) === state.subjectFilter);
}

function entriesByDate() {
  const map = new Map();
  filteredEntries().forEach((entry) => {
    if (!map.has(entry.date)) {
      map.set(entry.date, []);
    }
    map.get(entry.date).push(entry);
  });
  return map;
}

function chooseInitialDate() {
  const dates = filteredEntries().map((entry) => entry.date).sort();
  const localToday = window.SiteCommon.todayIso();
  if (!dates.length) {
    return localToday;
  }
  if (dates.includes(localToday)) {
    return localToday;
  }
  return dates.find((entryDate) => entryDate >= localToday) || dates[0];
}

function chooseDateForMonth(year, monthIndex) {
  const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  const localToday = window.SiteCommon.todayIso();
  const monthDates = Array.from(entriesByDate().keys())
    .filter((entryDate) => entryDate.startsWith(monthPrefix))
    .sort();

  if (localToday.startsWith(monthPrefix)) {
    return monthDates.includes(localToday) ? localToday : `${monthPrefix}-01`;
  }

  return monthDates[0] || `${monthPrefix}-01`;
}

function ensureSelectedDate() {
  if (!state.selectedDate) {
    state.selectedDate = chooseInitialDate();
  }
}

function populateFilters() {
  const previousValue = state.subjectFilter;
  els.subjectFilter.innerHTML = '<option value="all">All mapped subjects and events</option>';
  window.SiteCommon.getSubjectsForStudent(state.schedule, state.selectedStudent).forEach((subject) => {
    const option = document.createElement("option");
    option.value = String(subject.id);
    option.textContent = `${subject.name}${subject.code ? ` (${subject.code})` : ""}`;
    els.subjectFilter.appendChild(option);
  });
  const stillExists = Array.from(els.subjectFilter.options).some((option) => option.value === previousValue);
  state.subjectFilter = stillExists ? previousValue : "all";
  els.subjectFilter.value = state.subjectFilter;
}

function renderCalendar() {
  const { year, monthIndex } = state.monthCursor;
  els.monthLabel.textContent = window.SiteCommon.formatMonthLabel(year, monthIndex);
  els.calendarHeading.textContent = window.SiteCommon.formatMonthLabel(year, monthIndex);
  els.calendarGrid.innerHTML = "";

  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((weekday) => {
    const cell = document.createElement("div");
    cell.className = "calendar-weekday";
    cell.textContent = weekday;
    els.calendarGrid.appendChild(cell);
  });

  const dateMap = entriesByDate();
  const first = new Date(year, monthIndex, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, monthIndex, 1 - startOffset);

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(gridStart);
    current.setDate(gridStart.getDate() + index);
    const iso = window.SiteCommon.localIsoDate(current);
    const entries = (dateMap.get(iso) || []).slice().sort((left, right) => {
      return `${left.start_time}${left.title}`.localeCompare(`${right.start_time}${right.title}`);
    });
    const isCurrentMonth = current.getMonth() === monthIndex;
    const isToday = iso === window.SiteCommon.todayIso();
    const isSelected = iso === state.selectedDate;

    const button = document.createElement("button");
    button.type = "button";
    button.className = `calendar-day${isCurrentMonth ? "" : " muted"}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`;
    button.innerHTML = `
      <div class="day-head">
        <span class="day-number">${current.getDate()}</span>
        <span class="day-count">${entries.length || ""}</span>
      </div>
      <div class="dot-grid">
        ${entries.map((entry) => `<span class="dot${entry.type === "event" ? " event" : ""}"></span>`).join("")}
      </div>
    `;
    button.addEventListener("click", () => {
      state.selectedDate = iso;
      state.monthCursor = { year: current.getFullYear(), monthIndex: current.getMonth() };
      render();
    });
    els.calendarGrid.appendChild(button);
  }
}

function renderDayStats(dayEntries) {
  const lectureCount = dayEntries.filter((entry) => entry.type === "lecture").length;
  const eventCount = dayEntries.filter((entry) => entry.type === "event").length;
  els.dayStats.innerHTML = `
    <article class="day-stat">
      <span class="stat-label">Day total</span>
      <strong>${dayEntries.length}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Lectures</span>
      <strong>${lectureCount}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Events</span>
      <strong>${eventCount}</strong>
    </article>
    <article class="day-stat">
      <span class="stat-label">Selected date</span>
      <strong>${state.selectedDate}</strong>
    </article>
  `;
}

function buildEntryCard(entry, options = {}) {
  if (options.compact) {
    const card = document.createElement("article");
    card.className = "entry-card timeline-entry";
    if (entry.type === "event") {
      card.classList.add("is-event");
    }

    const subline =
      entry.type === "lecture"
        ? `Lecture ${entry.lecture_number}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`
        : `${entry.event_category || "event"}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`;

    card.innerHTML = `
      <p class="timeline-entry-time">${window.SiteCommon.formatEntryWindow(entry)}</p>
      <h3 class="entry-title">${entry.title}</h3>
      <p class="entry-subline">${subline}</p>
    `;
    return card;
  }

  const fragment = els.entryTemplate.content.cloneNode(true);
  fragment.querySelector(".entry-title").textContent = entry.title;
  fragment.querySelector(".entry-subline").textContent =
    entry.type === "lecture"
      ? `Lecture ${entry.lecture_number}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`
      : `${entry.event_category || "event"}${entry.subject?.code ? ` · ${entry.subject.code}` : ""}`;

  const chip = fragment.querySelector(".entry-chip");
  chip.textContent = entry.type === "event" ? entry.event_category || "event" : entry.schedule_status;
  if (entry.type === "event") {
    chip.classList.add("event");
  }

  const details = [
    ["Time", window.SiteCommon.formatEntryWindow(entry)],
    ["Faculty", entry.faculty || "Not listed"],
    ["Location", entry.location || "Not listed"],
  ];

  fragment.querySelector(".entry-details").innerHTML = details
    .map(
      ([label, value]) => `
        <div class="detail-group">
          <strong>${label}</strong>
          <span>${value}</span>
        </div>
      `
    )
    .join("");

  return fragment.querySelector(".entry-card");
}

function buildEmptyTimelineState() {
  const empty = document.createElement("article");
  empty.className = "entry-card empty";
  empty.innerHTML = `
    <div class="entry-topline">
      <div>
        <h3 class="entry-title">No schedule on this date</h3>
        <p class="entry-subline">The logged-in student has no classes or events on ${window.SiteCommon.formatHumanDate(state.selectedDate)}.</p>
      </div>
      <span class="entry-chip">Free day</span>
    </div>
  `;
  return empty;
}

function layoutTimelineEntries(entries) {
  return entries
    .map((entry) => ({
      ...entry,
      startMinutes: window.SiteCommon.timeToMinutes(entry.start_time),
      endMinutes: Math.max(window.SiteCommon.timeToMinutes(entry.end_time), window.SiteCommon.timeToMinutes(entry.start_time) + 15),
    }))
    .sort((left, right) => {
      if (left.startMinutes !== right.startMinutes) {
        return left.startMinutes - right.startMinutes;
      }
      return left.title.localeCompare(right.title);
    });
}

function renderTimeline() {
  const dayEntries = filteredEntries()
    .filter((entry) => entry.date === state.selectedDate)
    .sort((left, right) => `${left.start_time}${left.title}`.localeCompare(`${right.start_time}${right.title}`));

  els.selectedDayHeading.textContent = window.SiteCommon.formatHumanDate(state.selectedDate);
  els.timelineHeading.textContent = window.SiteCommon.formatHumanDate(state.selectedDate);
  renderDayStats(dayEntries);
  els.timeline.innerHTML = "";

  if (!dayEntries.length) {
    els.timeline.appendChild(buildEmptyTimelineState());
    return;
  }

  const shell = document.createElement("div");
  shell.className = "timeline-shell";

  const scale = document.createElement("div");
  scale.className = "timeline-scale";

  const canvas = document.createElement("div");
  canvas.className = "timeline-canvas";

  const dayColumn = document.createElement("div");
  dayColumn.className = "timeline-day-column";
  canvas.appendChild(dayColumn);

  for (let hour = 0; hour <= 24; hour += 1) {
    const ratio = (hour / 24) * 100;
    const label = document.createElement("div");
    label.className = "timeline-scale-label";
    label.style.top = `${ratio}%`;
    label.textContent = format24HourLabel(hour);
    scale.appendChild(label);

    if (hour < 24) {
      const line = document.createElement("div");
      line.className = "timeline-hour-line";
      line.style.top = `${ratio}%`;
      dayColumn.appendChild(line);

      const halfHourLine = document.createElement("div");
      halfHourLine.className = "timeline-half-hour-line";
      halfHourLine.style.top = `${((hour + 0.5) / 24) * 100}%`;
      dayColumn.appendChild(halfHourLine);
    }
  }

  const lunchSlot = state.schedule.slots.find((slot) => slot.kind === "lunch");
  if (lunchSlot) {
    const lunchBand = document.createElement("div");
    lunchBand.className = "timeline-lunch-band";
    lunchBand.style.top = `${(window.SiteCommon.timeToMinutes(lunchSlot.start_time) / (24 * 60)) * 100}%`;
    lunchBand.style.height = `${((window.SiteCommon.timeToMinutes(lunchSlot.end_time) - window.SiteCommon.timeToMinutes(lunchSlot.start_time)) / (24 * 60)) * 100}%`;
    lunchBand.innerHTML = `
      <span>Lunch Time</span>
      <small>${lunchSlot.start_time} - ${lunchSlot.end_time}</small>
    `;
    dayColumn.appendChild(lunchBand);
  }

  layoutTimelineEntries(dayEntries).forEach((entry) => {
    const card = buildEntryCard(entry, { compact: true });
    card.style.top = `${(entry.startMinutes / (24 * 60)) * 100}%`;
    card.style.height = `${((entry.endMinutes - entry.startMinutes) / (24 * 60)) * 100}%`;
    card.style.left = "18px";
    card.style.right = "18px";
    dayColumn.appendChild(card);
  });

  shell.appendChild(scale);
  shell.appendChild(canvas);
  els.timeline.appendChild(shell);
}

function render() {
  ensureSelectedDate();
  renderCalendar();
  renderTimeline();
}

async function init() {
  [state.schedule, state.directory] = await Promise.all([
    window.SiteCommon.loadScheduleData(),
    window.SiteCommon.loadStudentDirectory(),
  ]);

  state.selectedStudent = window.SiteCommon.requireLoggedInStudent(state.directory);
  if (!state.selectedStudent) {
    return;
  }

  window.SiteCommon.hydrateStudentSummary({
    directory: state.directory,
    schedule: state.schedule,
    student: state.selectedStudent,
    nameElement: els.studentName,
    codeElement: els.studentCode,
    sectionElement: els.studentSection,
    courseCountElement: els.studentCourseCount,
    nextClassElement: els.studentNextClass,
    switchButton: els.switchPersonButton,
  });

  populateFilters();
  state.selectedDate = chooseInitialDate();
  state.monthCursor = parseMonthCursor(monthKeyFromDate(state.selectedDate));
  render();

  els.subjectFilter.addEventListener("change", (event) => {
    state.subjectFilter = event.target.value;
    render();
  });

  els.prevMonth.addEventListener("click", () => {
    const next = new Date(state.monthCursor.year, state.monthCursor.monthIndex - 1, 1);
    state.monthCursor = { year: next.getFullYear(), monthIndex: next.getMonth() };
    state.selectedDate = chooseDateForMonth(state.monthCursor.year, state.monthCursor.monthIndex);
    render();
  });

  els.nextMonth.addEventListener("click", () => {
    const next = new Date(state.monthCursor.year, state.monthCursor.monthIndex + 1, 1);
    state.monthCursor = { year: next.getFullYear(), monthIndex: next.getMonth() };
    state.selectedDate = chooseDateForMonth(state.monthCursor.year, state.monthCursor.monthIndex);
    render();
  });

  els.todayButton.addEventListener("click", () => {
    state.selectedDate = chooseInitialDate();
    state.monthCursor = parseMonthCursor(monthKeyFromDate(state.selectedDate));
    render();
  });
}

init().catch((error) => {
  document.body.innerHTML = `
    <main class="site-shell">
      <section class="panel">
        <p class="eyebrow">Calendar</p>
        <h1>Could not load the TAPMI calendar</h1>
        <p class="hero-copy">${error.message}</p>
      </section>
    </main>
  `;
});
